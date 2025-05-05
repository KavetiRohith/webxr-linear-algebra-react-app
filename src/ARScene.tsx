import { useRef, useEffect, useMemo } from "react";
import { Text, Line } from "@react-three/drei";
import { Interactive } from "@react-three/xr";
import { Vector3, Euler, Quaternion, Mesh, Line3 } from "three";
import { create } from "zustand";
import { generateUUID } from "three/src/math/MathUtils.js";

const EPSILON = 1e-6;
const SQ_EPSILON = EPSILON * EPSILON;

interface MathObject {
  id: string;
  type: "plane";
  position: Vector3;
  rotation: Euler;
  color: string;
  equation: string;
  visible: boolean;
}

interface PlaneEqParams {
  paramA: number;
  paramB: number;
  paramC: number;
  paramD: number;
}

type Matrix = number[][];
type RrefModeState = "editing" | "viewing";

type RrefAnalysisResult = {
  consistency: "consistent" | "inconsistent";
  solutionType: "none" | "unique" | "infinite_line" | "infinite_plane";
  solutionString: string;
  solutionPoint: Vector3 | null;
};

interface LinePlaneStoreState {
  objects: MathObject[];
  selectedObjectId: string | null;
  mode: "random" | "equation" | "rref";
  planeParams: PlaneEqParams;

  initialRrefMatrix: Matrix;
  rrefHistory: Matrix[];
  rrefStepIndex: number;
  rrefState: RrefModeState;
  rrefAnalysis: RrefAnalysisResult | null;
  rrefUniqueSolutionPoint: Vector3 | null;

  addPlane: (
    position?: Vector3,
    rotation?: Euler,
    params?: PlaneEqParams
  ) => void;
  removeObject: (id: string) => void;
  updateObjectPosition: (id: string, position: Vector3) => void;
  updateEquation: (id: string) => void;
  selectObject: (id: string | null) => void;
  clearAll: () => void;
  setMode: (mode: "random" | "equation" | "rref") => void;
  setPlaneParam: (param: keyof PlaneEqParams, value: number) => void;
  spawnFromEquation: () => void;

  updateInitialRrefCell: (row: number, col: number, value: number) => void;
  calculateAndStartRrefViewing: () => void;
  resetRrefToEditing: () => void;
  stepRrefHistory: (direction: "back" | "forward") => void;
}

const defaultPlaneParams: PlaneEqParams = {
  paramA: 0,
  paramB: 1,
  paramC: 0,
  paramD: 1,
};

const sampleMatrix: Matrix = [
  [1, 2, -1, 3],
  [2, 1, 1, 3],
  [1, 1, 1, 2],
];

const deepCopyMatrix = (matrix: Matrix): Matrix =>
  matrix.map((row) => [...row]);

const getPlaneTransform = (
  params: PlaneEqParams
): { position: Vector3; rotation: Euler } => {
  const normal = new Vector3(params.paramA, params.paramB, params.paramC);
  const d_rhs = params.paramD;
  const normalLenSq = normal.lengthSq();

  if (normalLenSq < SQ_EPSILON) {
    console.warn(
      "Degenerate plane definition (zero normal). Positioning arbitrarily."
    );

    return { position: new Vector3(0, -999 + d_rhs, 0), rotation: new Euler() };
  }

  const normalNormalized = normal.clone().normalize();

  const position = normal.clone().multiplyScalar(d_rhs / normalLenSq);

  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    normalNormalized
  );
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};

const getPlaneTransformFromRow = (
  row: number[]
): { position: Vector3; rotation: Euler; isValid: boolean } | null => {
  if (row.length < 4) return null;
  const a = row[0];
  const b = row[1];
  const c = row[2];
  const d_rhs = row[3];
  const normal = new Vector3(a, b, c);
  const normalLenSq = normal.lengthSq();

  if (normalLenSq < SQ_EPSILON) {
    const isValid = Math.abs(d_rhs) < EPSILON;
    return {
      position: new Vector3(0, -999, 0),
      rotation: new Euler(),
      isValid: isValid,
    };
  }

  const normalNormalized = normal.clone().normalize();

  const position = normal.clone().multiplyScalar(d_rhs / normalLenSq);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    normalNormalized
  );
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation, isValid: true };
};

const calculateRrefSteps = (initialMatrix: Matrix): Matrix[] => {
  const history: Matrix[] = [deepCopyMatrix(initialMatrix)];
  let matrix = deepCopyMatrix(initialMatrix);
  const numRows = matrix.length;
  if (numRows === 0) return history;
  const numCols = matrix[0]?.length || 0;
  if (numCols === 0) return history;
  let pivotRow = 0;

  for (
    let pivotCol = 0;
    pivotCol < numCols - 1 && pivotRow < numRows;
    pivotCol++
  ) {
    let maxRow = pivotRow;
    for (let k = pivotRow + 1; k < numRows; k++) {
      if (Math.abs(matrix[k][pivotCol]) > Math.abs(matrix[maxRow][pivotCol])) {
        maxRow = k;
      }
    }
    if (Math.abs(matrix[maxRow][pivotCol]) < EPSILON) {
      continue;
    }
    if (maxRow !== pivotRow) {
      [matrix[pivotRow], matrix[maxRow]] = [matrix[maxRow], matrix[pivotRow]];
      history.push(deepCopyMatrix(matrix));
    }
    const pivotValue = matrix[pivotRow][pivotCol];
    if (Math.abs(pivotValue - 1.0) > EPSILON) {
      matrix[pivotRow] = matrix[pivotRow].map((el) => el / pivotValue);
      matrix[pivotRow] = matrix[pivotRow].map((val) =>
        Math.abs(val) < EPSILON ? 0 : val
      );
      history.push(deepCopyMatrix(matrix));
    }
    for (let i = 0; i < numRows; i++) {
      if (i !== pivotRow) {
        const factor = matrix[i][pivotCol];
        if (Math.abs(factor) > EPSILON) {
          matrix[i] = matrix[i].map(
            (el, j) => el - factor * matrix[pivotRow][j]
          );
          matrix[i] = matrix[i].map((val) =>
            Math.abs(val) < EPSILON ? 0 : val
          );
          history.push(deepCopyMatrix(matrix));
        }
      }
    }
    pivotRow++;
  }

  for (let i = numRows - 1; i >= 0; i--) {
    let pivotCol = -1;
    for (let j = 0; j < numCols - 1; j++) {
      if (Math.abs(matrix[i][j] - 1.0) < EPSILON) {
        let isLeading = true;
        for (let k = 0; k < j; k++) {
          if (Math.abs(matrix[i][k]) > EPSILON) {
            isLeading = false;
            break;
          }
        }
        if (isLeading) {
          pivotCol = j;
          break;
        }
      } else if (Math.abs(matrix[i][j]) > EPSILON) {
        break;
      }
    }
    if (pivotCol !== -1) {
      for (let k = i - 1; k >= 0; k--) {
        const factor = matrix[k][pivotCol];
        if (Math.abs(factor) > EPSILON) {
          matrix[k] = matrix[k].map((el, j) => el - factor * matrix[i][j]);
          matrix[k] = matrix[k].map((val) =>
            Math.abs(val) < EPSILON ? 0 : val
          );
          history.push(deepCopyMatrix(matrix));
        }
      }
    }
  }
  return history;
};

const analyzeRref = (rrefMatrix: Matrix): RrefAnalysisResult => {
  const numRows = rrefMatrix.length;
  if (numRows === 0)
    return {
      consistency: "inconsistent",
      solutionType: "none",
      solutionString: "No equations.",
      solutionPoint: null,
    };
  const numCols = rrefMatrix[0]?.length || 0;
  if (numCols < 2)
    return {
      consistency: "inconsistent",
      solutionType: "none",
      solutionString: "Invalid matrix shape.",
      solutionPoint: null,
    };
  const numVars = numCols - 1;

  let rank = 0;
  let inconsistent = false;

  for (let r = 0; r < numRows; r++) {
    let pivotFoundInRow = false;
    for (let c = 0; c < numCols; c++) {
      if (Math.abs(rrefMatrix[r][c]) > EPSILON) {
        if (c < numVars) {
          pivotFoundInRow = true;
        } else {
          inconsistent = true;
        }
        break;
      }
    }
    if (inconsistent) break;
    if (pivotFoundInRow) rank++;
  }

  if (inconsistent) {
    return {
      consistency: "inconsistent",
      solutionType: "none",
      solutionString: "Inconsistent system (no solution).",
      solutionPoint: null,
    };
  }

  if (rank === numVars) {
    let solPoint = new Vector3();
    let solStr = "Unique Solution: (Error)";
    try {
      let x_val = 0,
        y_val = 0,
        z_val = 0;
      for (let r = 0; r < rank; r++) {
        let pivotCol = -1;
        for (let c = 0; c < numVars; c++) {
          if (Math.abs(rrefMatrix[r][c] - 1.0) < EPSILON) {
            let isLeading = true;
            for (let k = 0; k < c; k++) {
              if (Math.abs(rrefMatrix[r][k]) > EPSILON) {
                isLeading = false;
                break;
              }
            }
            if (isLeading) {
              pivotCol = c;
              break;
            }
          } else if (Math.abs(rrefMatrix[r][c]) > EPSILON) {
            break;
          }
        }
        if (pivotCol === 0) x_val = rrefMatrix[r][numVars];
        else if (pivotCol === 1) y_val = rrefMatrix[r][numVars];
        else if (pivotCol === 2) z_val = rrefMatrix[r][numVars];
      }
      solPoint.set(x_val, y_val, z_val);
      solStr = `Unique Solution: (${solPoint.x.toFixed(2)}, ${solPoint.y.toFixed(2)}, ${solPoint.z.toFixed(2)})`;
      return {
        consistency: "consistent",
        solutionType: "unique",
        solutionString: solStr,
        solutionPoint: solPoint,
      };
    } catch (e) {
      console.error("Error extracting unique solution:", e);
      return {
        consistency: "consistent",
        solutionType: "unique",
        solutionString: "Unique Solution (Error parsing values)",
        solutionPoint: null,
      };
    }
  } else {
    const freeVars = numVars - rank;
    let type: RrefAnalysisResult["solutionType"] = "infinite_line";
    let typeStr = `Infinite Solutions (${freeVars} free variable(s))`;
    if (numVars === 3) {
      if (freeVars === 1) {
        type = "infinite_line";
        typeStr = "Infinite Solutions (Line)";
      }
      if (freeVars === 2) {
        type = "infinite_plane";
        typeStr = "Infinite Solutions (Plane)";
      }
      if (freeVars === 3 && rank === 0) {
        type = "infinite_plane";
        typeStr = "Infinite Solutions (All R³)";
      }
    }
    return {
      consistency: "consistent",
      solutionType: type,
      solutionString: typeStr,
      solutionPoint: null,
    };
  }
};

export const useLinePlaneStore = create<LinePlaneStoreState>((set, get) => ({
  objects: [],
  selectedObjectId: null,
  mode: "random",
  planeParams: { ...defaultPlaneParams },
  initialRrefMatrix: deepCopyMatrix(sampleMatrix),
  rrefHistory: [],
  rrefStepIndex: -1,
  rrefState: "editing",
  rrefAnalysis: null,
  rrefUniqueSolutionPoint: null,

  addPlane: (position?: Vector3, rotation?: Euler, params?: PlaneEqParams) => {
    let pos = position;
    let rot = rotation;
    let eq = "";

    if (params) {
      const transform = getPlaneTransform(params);
      pos = transform.position;
      rot = transform.rotation;

      const formatNum = (n: number) => n.toFixed(1).replace(".0", "");
      eq = `${formatNum(params.paramA)}x + ${formatNum(params.paramB)}y + ${formatNum(params.paramC)}z = ${formatNum(params.paramD)}`;
    } else {
      pos ||= new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.5,
        Math.random() * 2 - 1
      );
      rot ||= new Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
    }

    const id = generateUUID();
    const plane: MathObject = {
      id,
      type: "plane",
      position: pos.clone(),
      rotation: rot.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: eq,
      visible: true,
    };
    set((state) => ({
      objects: [...state.objects, plane],
      selectedObjectId: id,
    }));

    if (!eq) {
      get().updateEquation(id);
    }
  },
  removeObject: (id) => {
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectId:
        state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
  },
  updateObjectPosition: (id, position) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, position: position.clone() } : obj
      ),
    }));
    get().updateEquation(id);
  },

  updateEquation: (id) => {
    const object = get().objects.find((obj) => obj.id === id);
    if (!object || object.type !== "plane") return;
    let equation = "";
    const normal = new Vector3(0, 0, 1).applyEuler(object.rotation).normalize();

    const d_rhs = normal.dot(object.position);
    const a = normal.x;
    const b = normal.y;
    const c = normal.z;

    const formatCoeff = (val: number, axis: string) => {
      if (Math.abs(val) < 0.01) return "";
      const sign = val >= 0 ? "+ " : "- ";
      const num = Math.abs(val).toFixed(2);
      const numStr = num === "1.00" && axis ? "" : num;
      return `${sign}${numStr}${axis} `;
    };
    const formatD = (val: number) => val.toFixed(2);

    let eq =
      `${formatCoeff(a, "x")}${formatCoeff(b, "y")}${formatCoeff(c, "z")}`.trim();
    if (eq.startsWith("+ ")) eq = eq.substring(2);
    if (eq === "") eq = "0";

    equation = `${eq} = ${formatD(d_rhs)}`;

    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, equation } : obj
      ),
    }));
  },
  selectObject: (id) => {
    set({ selectedObjectId: id });
  },
  clearAll: () => set({ objects: [], selectedObjectId: null }),
  setMode: (mode) => {
    if (mode === "rref") {
      set({
        mode: "rref",
        rrefState: "editing",
        initialRrefMatrix: deepCopyMatrix(sampleMatrix),
        rrefHistory: [],
        rrefStepIndex: -1,
        rrefAnalysis: null,
        rrefUniqueSolutionPoint: null,
        objects: [],
        selectedObjectId: null,
      });
    } else {
      set({
        mode: mode,
        rrefHistory: [],
        rrefStepIndex: -1,
        rrefAnalysis: null,
        rrefUniqueSolutionPoint: null,
      });
    }
  },
  setPlaneParam: (param, value) =>
    set((s) => ({ planeParams: { ...s.planeParams, [param]: value } })),
  spawnFromEquation: () => {
    const { planeParams, addPlane } = get();

    addPlane(undefined, undefined, planeParams);
  },

  updateInitialRrefCell: (row, col, value) => {
    const currentMatrix = get().initialRrefMatrix;
    if (
      row < 0 ||
      row >= currentMatrix.length ||
      col < 0 ||
      col >= currentMatrix[0].length
    )
      return;
    const newMatrix = deepCopyMatrix(currentMatrix);
    newMatrix[row][col] = value;
    set({ initialRrefMatrix: newMatrix });
  },
  calculateAndStartRrefViewing: () => {
    const initialMatrix = get().initialRrefMatrix;
    const history = calculateRrefSteps(initialMatrix);
    const finalMatrix =
      history.length > 0 ? history[history.length - 1] : initialMatrix;
    const analysis = analyzeRref(finalMatrix);
    set({
      rrefHistory: history,
      rrefStepIndex: 0,
      rrefState: "viewing",
      rrefAnalysis: analysis,
      rrefUniqueSolutionPoint: analysis.solutionPoint,
    });
  },
  resetRrefToEditing: () => {
    set({
      rrefState: "editing",
      rrefHistory: [],
      rrefStepIndex: -1,
      rrefAnalysis: null,
      rrefUniqueSolutionPoint: null,
    });
  },
  stepRrefHistory: (direction) => {
    const { rrefHistory, rrefStepIndex, rrefState } = get();
    if (rrefState !== "viewing") return;
    if (direction === "back") {
      const newIndex = Math.max(0, rrefStepIndex - 1);
      set({ rrefStepIndex: newIndex });
    } else if (direction === "forward") {
      const newIndex = Math.min(rrefHistory.length - 1, rrefStepIndex + 1);
      set({ rrefStepIndex: newIndex });
    }
  },
}));

const getPlaneParamsIntersection = (
  planeObj: MathObject
): { normal: Vector3; constantD: number } | null => {
  if (planeObj.type !== "plane") return null;
  const normal = new Vector3(0, 0, 1).applyEuler(planeObj.rotation).normalize();
  const D = -normal.dot(planeObj.position);
  return { normal, constantD: D };
};

const intersectPlanePlane = (
  plane1Obj: MathObject,
  plane2Obj: MathObject
): { line: Line3; label: string } | null => {
  if (plane1Obj.type !== "plane" || plane2Obj.type !== "plane") return null;

  const p1Geom = getPlaneParamsIntersection(plane1Obj);
  const p2Geom = getPlaneParamsIntersection(plane2Obj);
  if (!p1Geom || !p2Geom) return null;
  const n1 = p1Geom.normal;
  const D1 = p1Geom.constantD;
  const n2 = p2Geom.normal;
  const D2 = p2Geom.constantD;

  const lineDirection = new Vector3().crossVectors(n1, n2);
  const n1xn2MagSq = lineDirection.lengthSq();
  if (n1xn2MagSq < SQ_EPSILON) {
    return null;
  }
  lineDirection.normalize();

  let linePoint: Vector3 | null = null;
  const n1xn2NonNormalized = new Vector3().crossVectors(n1, n2);
  const term1 = n2.clone().multiplyScalar(-D1);
  const term2 = n1.clone().multiplyScalar(-D2);
  linePoint = new Vector3()
    .crossVectors(term1.sub(term2), n1xn2NonNormalized)
    .divideScalar(n1xn2MagSq);

  if (!linePoint) {
    console.warn("Failed to find plane-plane intersection point.");
    return null;
  }
  const label = `P = (${linePoint.x.toFixed(1)}, ${linePoint.y.toFixed(1)}, ${linePoint.z.toFixed(1)}) + t(${lineDirection.x.toFixed(1)}, ${lineDirection.y.toFixed(1)}, ${lineDirection.z.toFixed(1)})`;
  const segmentLength = 10;
  const halfLength = segmentLength / 2;
  const startPoint = linePoint
    .clone()
    .addScaledVector(lineDirection, -halfLength);
  const endPoint = linePoint.clone().addScaledVector(lineDirection, halfLength);
  const lineSegment = new Line3(startPoint, endPoint);
  return { line: lineSegment, label: label };
};

const intersectThreePlanes = (
  plane1Obj: MathObject,
  plane2Obj: MathObject,
  plane3Obj: MathObject
): { point: Vector3; label: string } | null => {
  if (
    plane1Obj.type !== "plane" ||
    plane2Obj.type !== "plane" ||
    plane3Obj.type !== "plane"
  )
    return null;

  const p1Geom = getPlaneParamsIntersection(plane1Obj);
  const p2Geom = getPlaneParamsIntersection(plane2Obj);
  const p3Geom = getPlaneParamsIntersection(plane3Obj);
  if (!p1Geom || !p2Geom || !p3Geom) return null;
  const n1 = p1Geom.normal;
  const D1 = p1Geom.constantD;
  const n2 = p2Geom.normal;
  const D2 = p2Geom.constantD;
  const n3 = p3Geom.normal;
  const D3 = p3Geom.constantD;
  const det = n1.dot(new Vector3().crossVectors(n2, n3));
  if (Math.abs(det) < EPSILON) {
    return null;
  }
  const n2xn3 = new Vector3().crossVectors(n2, n3);
  const n3xn1 = new Vector3().crossVectors(n3, n1);
  const n1xn2 = new Vector3().crossVectors(n1, n2);
  const term1 = n2xn3.multiplyScalar(-D1);
  const term2 = n3xn1.multiplyScalar(-D2);
  const term3 = n1xn2.multiplyScalar(-D3);
  const intersectionPoint = new Vector3()
    .add(term1)
    .add(term2)
    .add(term3)
    .divideScalar(det);
  const p = intersectionPoint;
  const label = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
  return { point: p, label: label };
};

const IntersectionPoint = ({
  position,
  label,
}: {
  position: Vector3;
  label: string;
}) => (
  <group position={position}>
    <mesh>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshStandardMaterial
        color="#ffff00"
        emissive="#ccaa00"
        emissiveIntensity={0.6}
      />
    </mesh>
    <Text
      position={[0, 0.06, 0]}
      fontSize={0.045}
      color="yellow"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.002}
      outlineColor="#000000"
    >
      {label}
    </Text>
  </group>
);
const IntersectionLine = ({ line, label }: { line: Line3; label: string }) => {
  const centerPoint = useMemo(() => line.getCenter(new Vector3()), [line]);
  const lineDir = useMemo(() => {
    const dir = new Vector3().subVectors(line.end, line.start);
    const len = dir.length();
    return len > EPSILON ? dir.divideScalar(len) : new Vector3(1, 0, 0);
  }, [line]);
  return (
    <group>
      <Line points={[line.start, line.end]} color="#ff00ff" lineWidth={4} />
      <Text
        position={centerPoint.addScaledVector(lineDir, 0.1)}
        fontSize={0.045}
        color="#ff88ff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.002}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
};

const MathPlane = ({
  id,
  position,
  rotation,
  color,
  isSelected,
  equation,
}: {
  id: string;
  position: Vector3;
  rotation: Euler;
  color: string;
  isSelected: boolean;
  equation?: string;
}) => {
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  const meshRef = useRef<Mesh>(null);
  const isDraggingRef = useRef(false);
  const isInRrefMode = useLinePlaneStore((state) => state.mode === "rref");
  const handleSelect =
    !isInRrefMode && selectObject ? () => selectObject(id) : () => {};
  const displayEquation =
    equation ??
    useLinePlaneStore(
      (state) => state.objects.find((obj) => obj.id === id)?.equation
    );
  const handlePointerDown = (e: any) => {
    if (!isInRrefMode && isSelected && !isDraggingRef.current) {
      e.stopPropagation();
      isDraggingRef.current = true;
    }
  };
  const handlePointerMove = (e: any) => {
    if (!isInRrefMode && isSelected && isDraggingRef.current) {
      e.stopPropagation();
      updateObjectPosition(id, e.point);
    }
  };
  const handlePointerUp = (_e: any) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
  };
  const handlePointerLeave = (_e: any) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
    }
  };
  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={meshRef}
        onClick={handleSelect}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <planeGeometry args={isInRrefMode ? [4, 4] : [1, 1]} />
        <meshStandardMaterial
          color={color}
          opacity={0.65}
          transparent
          side={2}
          emissive={isSelected ? color : undefined}
          emissiveIntensity={0.3}
        />
      </mesh>
      <Text
        position={[0, 0, 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {displayEquation || ""}
      </Text>
    </group>
  );
};

const CoordinateSystem = () => (
  <group>
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.03]} />
      <meshStandardMaterial color="#ffffff" />
    </mesh>
    <Line
      points={[
        [0, 0, 0],
        [1, 0, 0],
      ]}
      color="red"
      lineWidth={2}
    />
    <Text position={[1.1, 0, 0]} fontSize={0.05} color="red">
      X
    </Text>
    <Line
      points={[
        [0, 0, 0],
        [0, 1, 0],
      ]}
      color="green"
      lineWidth={2}
    />
    <Text position={[0, 1.1, 0]} fontSize={0.05} color="green">
      Y
    </Text>
    <Line
      points={[
        [0, 0, 0],
        [0, 0, 1],
      ]}
      color="blue"
      lineWidth={2}
    />
    <Text position={[0, 0, 1.1]} fontSize={0.05} color="blue">
      Z
    </Text>
    <gridHelper args={[4, 20, "#555", "#333"]} position={[0, -0.01, 0]} />
  </group>
);

const PanelButton = ({
  label,
  position,
  onSelect,
  color = "#446",
  width = 0.3,
  height = 0.04,
  fontSize = 0.02,
  disabled = false,
}: {
  label: string;
  position: [number, number, number];
  onSelect: () => void;
  color?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  disabled?: boolean;
}) => (
  <Interactive onSelect={disabled ? () => {} : onSelect}>
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={disabled ? "#555" : color}
          transparent
          opacity={disabled ? 0.5 : 0.9}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 0, 0.001]}
        fontSize={fontSize}
        color={disabled ? "#aaa" : "white"}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  </Interactive>
);

const ValueAdjuster = ({
  label,
  value,
  min,
  max,
  onChange,
  yPos,
  isMatrixCell = false,
  rowIndex,
  colIndex,
  paramKey,
}: {
  label?: string;
  value: number;
  min: number;
  max: number;
  onChange: (keyOrRow: any, valueOrCol: any, value?: any) => void;
  yPos: number;
  isMatrixCell?: boolean;
  rowIndex?: number;
  colIndex?: number;
  paramKey?: keyof PlaneEqParams;
}) => {
  const buttonSize = 0.035;
  const spacing = 0.01;
  const buttonSpacing = 0.015;
  const valueDisplayWidth = 0.06;
  const increment = 0.5;
  const handleDecrement = () => {
    const newValue = Math.max(min, value - increment);
    if (
      isMatrixCell &&
      typeof rowIndex === "number" &&
      typeof colIndex === "number"
    ) {
      onChange(rowIndex, colIndex, newValue);
    } else if (paramKey) {
      onChange(paramKey, newValue);
    }
  };
  const handleIncrement = () => {
    const newValue = Math.min(max, value + increment);
    if (
      isMatrixCell &&
      typeof rowIndex === "number" &&
      typeof colIndex === "number"
    ) {
      onChange(rowIndex, colIndex, newValue);
    } else if (paramKey) {
      onChange(paramKey, newValue);
    }
  };
  const formatDisplayValue = (val: number) => val.toFixed(1).replace(".0", "");
  const buttonOffsetX = valueDisplayWidth / 2 + buttonSpacing;
  return (
    <group position={[0, yPos, 0.01]}>
      {label && (
        <Text
          position={[-buttonOffsetX - buttonSize / 2 - spacing, 0, 0]}
          fontSize={0.018}
          color="white"
          anchorX="right"
          anchorY="middle"
        >
          {label}:
        </Text>
      )}
      <Text
        position={[0, 0, 0]}
        fontSize={0.02}
        color="yellow"
        anchorX="center"
        anchorY="middle"
        maxWidth={valueDisplayWidth}
      >
        {formatDisplayValue(value)}
      </Text>
      <Interactive onSelect={handleDecrement}>
        <mesh position={[-buttonOffsetX, 0, 0]}>
          <planeGeometry args={[buttonSize, buttonSize]} />
          <meshStandardMaterial color="#b55" side={2} />
        </mesh>
        <Text
          position={[-buttonOffsetX, 0, 0.001]}
          fontSize={0.025}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          -
        </Text>
      </Interactive>
      <Interactive onSelect={handleIncrement}>
        <mesh position={[buttonOffsetX, 0, 0]}>
          <planeGeometry args={[buttonSize, buttonSize]} />
          <meshStandardMaterial color="#5b5" side={2} />
        </mesh>
        <Text
          position={[buttonOffsetX, 0, 0.001]}
          fontSize={0.025}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          +
        </Text>
      </Interactive>
    </group>
  );
};

const ControlPanel = () => {
  const { selectedObjectId, addPlane, removeObject, clearAll, setMode } =
    useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  const handleClearAll = () => {
    clearAll();
  };
  const handleSetupRref = () => {
    setMode("rref");
  };
  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh>
        <planeGeometry args={[0.4, 0.4]} />
        <meshStandardMaterial
          color="#22224a"
          transparent
          opacity={0.8}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 0.17, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Controls
      </Text>
      <PanelButton
        label="Add Random Plane"
        position={[0, 0.1, 0.01]}
        onSelect={() => addPlane()}
      />
      {selectedObjectId && (
        <PanelButton
          label="Delete Selected"
          position={[0, 0.05, 0.01]}
          onSelect={() => removeObject(selectedObjectId)}
          color="#a44"
        />
      )}
      <PanelButton
        label="Clear All"
        position={[0, 0.0, 0.01]}
        onSelect={handleClearAll}
        color="#6f2ca5"
      />
      <PanelButton
        label="Define Plane Eq"
        position={[0, -0.05, 0.01]}
        onSelect={() => setMode("equation")}
        color="#276"
        width={0.35}
      />
      <PanelButton
        label="Setup RREF"
        position={[0, -0.12, 0.01]}
        onSelect={handleSetupRref}
        color="#088"
        width={0.35}
      />
    </group>
  );
};

const EquationPanel = () => {
  const { planeParams, setPlaneParam, spawnFromEquation, setMode } =
    useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh>
        <planeGeometry args={[0.45, 0.45]} />
        <meshStandardMaterial
          color="#2a224a"
          transparent
          opacity={0.85}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 0.19, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Define Plane Equation
      </Text>
      <>
        <Text
          position={[-0.2, 0.13, 0.01]}
          fontSize={0.018}
          color="salmon"
          anchorX="left"
        >
          Coefficients (a, b, c)
        </Text>
        <ValueAdjuster
          label="a "
          value={planeParams.paramA}
          min={-10}
          max={10}
          onChange={setPlaneParam}
          paramKey="paramA"
          yPos={0.09}
        />
        <ValueAdjuster
          label="b "
          value={planeParams.paramB}
          min={-10}
          max={10}
          onChange={setPlaneParam}
          paramKey="paramB"
          yPos={0.04}
        />
        <ValueAdjuster
          label="c "
          value={planeParams.paramC}
          min={-10}
          max={10}
          onChange={setPlaneParam}
          paramKey="paramC"
          yPos={-0.01}
        />
        <Text
          position={[-0.2, -0.06, 0.01]}
          fontSize={0.018}
          color="gold"
          anchorX="left"
        >
          Constant d (ax+by+cz=d)
        </Text>
        <ValueAdjuster
          label="d"
          value={planeParams.paramD}
          min={-10}
          max={10}
          onChange={setPlaneParam}
          paramKey="paramD"
          yPos={-0.1}
        />
      </>
      <PanelButton
        label="Spawn Plane"
        position={[0, -0.16, 0.01]}
        onSelect={spawnFromEquation}
        color="#2a5"
        width={0.25}
      />
      <PanelButton
        label="Back to Controls"
        position={[0, -0.21, 0.01]}
        onSelect={() => setMode("random")}
        color="#777"
        width={0.25}
      />
    </group>
  );
};

const RrefPanel = () => {
  const {
    initialRrefMatrix,
    rrefHistory,
    rrefStepIndex,
    rrefState,
    rrefAnalysis,
    updateInitialRrefCell,
    calculateAndStartRrefViewing,
    resetRrefToEditing,
    stepRrefHistory,
    setMode,
  } = useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.2, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  const cellWidth = 0.15;
  const cellHeight = 0.06;
  const cellPadding = 0.03;
  const matrixToDisplay =
    rrefState === "editing"
      ? initialRrefMatrix
      : rrefHistory && rrefHistory.length > 0 && rrefStepIndex >= 0
        ? rrefHistory[rrefStepIndex]
        : null;
  if (!matrixToDisplay) {
    return (
      <group position={panelPosition} rotation={panelRotation}>
        <Text color="orange">RREF data loading...</Text>
      </group>
    );
  }
  const numRows = matrixToDisplay.length;
  const numCols = matrixToDisplay[0]?.length || 0;
  const matrixWidth =
    numCols * cellWidth + (numCols > 0 ? (numCols - 1) * cellPadding : 0);
  const matrixOriginX = -matrixWidth / 2;
  const matrixOriginY = 0.2;
  const panelWidth = Math.max(0.7, matrixWidth + 0.2);
  const panelHeight = 0.85;
  const formatNumberDisplay = (num: number) => {
    if (Math.abs(num) < EPSILON) return "0";
    return num
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/\.?0+$/, "");
  };
  const isViewingLastStep =
    rrefState === "viewing" && rrefStepIndex === rrefHistory.length - 1;
  const buttonsY = matrixOriginY - numRows * (cellHeight + cellPadding) - 0.05;
  const analysisY = buttonsY - 0.08;
  const bottomButtonsY =
    analysisY - (isViewingLastStep && rrefAnalysis ? 0.1 : 0.0);
  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshStandardMaterial
          color="#1a3a3a"
          transparent
          opacity={0.9}
          side={2}
        />
      </mesh>
      <Text
        position={[0, panelHeight / 2 - 0.04, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {rrefState === "editing"
          ? "Edit Initial Matrix"
          : "Row Reduction Steps"}
      </Text>
      {rrefState === "viewing" && (
        <Text
          position={[0, panelHeight / 2 - 0.08, 0.01]}
          fontSize={0.018}
          color="cyan"
          anchorX="center"
        >
          Step {rrefStepIndex + 1} / {rrefHistory.length}
        </Text>
      )}
      <group position={[matrixOriginX, matrixOriginY, 0.01]}>
        {matrixToDisplay.map((row, r) => (
          <group
            key={`row-${r}`}
            position={[0, -r * (cellHeight + cellPadding), 0]}
          >
            {row.map((cell, c) => (
              <group
                key={`cell-${r}-${c}`}
                position={[c * (cellWidth + cellPadding), 0, 0]}
              >
                {rrefState === "editing" ? (
                  <ValueAdjuster
                    value={cell}
                    min={-10}
                    max={10}
                    onChange={updateInitialRrefCell}
                    yPos={0}
                    isMatrixCell={true}
                    rowIndex={r}
                    colIndex={c}
                  />
                ) : (
                  <>
                    <mesh>
                      <planeGeometry args={[cellWidth, cellHeight]} />
                      <meshStandardMaterial color="#334444" />
                    </mesh>
                    <Text
                      position={[0, 0, 0.001]}
                      fontSize={0.02}
                      color="white"
                      anchorX="center"
                      anchorY="middle"
                    >
                      {formatNumberDisplay(cell)}
                    </Text>
                  </>
                )}
              </group>
            ))}
          </group>
        ))}
      </group>
      <group position={[0, buttonsY, 0.01]}>
        {rrefState === "editing" ? (
          <>
            <PanelButton
              label="Calculate RREF Steps"
              position={[0, 0, 0]}
              width={0.4}
              height={0.04}
              fontSize={0.018}
              color={"#4a4"}
              onSelect={calculateAndStartRrefViewing}
            />
            <PanelButton
              label="Back to Controls"
              position={[0, -0.06, 0]}
              width={0.3}
              onSelect={() => setMode("random")}
              color="#777"
            />
          </>
        ) : (
          <>
            <group position={[0, 0, 0]}>
              <PanelButton
                label="< Prev Step"
                position={[-0.15, 0, 0]}
                width={0.18}
                height={0.04}
                fontSize={0.018}
                color={"#aaa"}
                onSelect={() => stepRrefHistory("back")}
                disabled={rrefStepIndex <= 0}
              />
              <PanelButton
                label="Next Step >"
                position={[0.15, 0, 0]}
                width={0.18}
                height={0.04}
                fontSize={0.018}
                color={"#aaa"}
                onSelect={() => stepRrefHistory("forward")}
                disabled={rrefStepIndex >= rrefHistory.length - 1}
              />
            </group>
            {isViewingLastStep && rrefAnalysis && (
              <group position={[0, -0.06, 0]}>
                <Text
                  fontSize={0.018}
                  color={
                    rrefAnalysis.consistency === "inconsistent"
                      ? "red"
                      : "lightgreen"
                  }
                  anchorX="center"
                  position={[0, 0, 0.01]}
                >
                  {rrefAnalysis.consistency === "inconsistent"
                    ? "System Inconsistent"
                    : "System Consistent"}
                </Text>
                <Text
                  fontSize={0.016}
                  color="white"
                  anchorX="center"
                  position={[0, -0.025, 0.01]}
                  maxWidth={panelWidth * 0.9}
                >
                  {rrefAnalysis.solutionString}
                </Text>
              </group>
            )}
            <group position={[0, bottomButtonsY, 0.01]}>
              <PanelButton
                label="Reset / Edit Initial"
                position={[0, 0, 0]}
                width={0.3}
                height={0.035}
                fontSize={0.015}
                color={"#f88"}
                onSelect={resetRrefToEditing}
              />
              <PanelButton
                label="Back to Controls"
                position={[0, -0.05, 0]}
                width={0.3}
                onSelect={() => setMode("random")}
                color="#777"
              />
            </group>
          </>
        )}
      </group>
    </group>
  );
};

export const ARScene = () => {
  const {
    objects,
    selectedObjectId,
    mode,
    initialRrefMatrix,
    rrefHistory,
    rrefStepIndex,
    rrefState,
    rrefAnalysis,
    rrefUniqueSolutionPoint,
  } = useLinePlaneStore();

  const didSeedRef = useRef(false);
  useEffect(() => {
    if (
      mode !== "rref" &&
      !didSeedRef.current &&
      useLinePlaneStore.getState().objects.length === 0
    ) {
      useLinePlaneStore.getState().addPlane();
      didSeedRef.current = true;
    }
  }, [mode]);

  const rrefScale = 1 / 3;

  const rrefPlaneData = useMemo(() => {
    if (mode !== "rref") return [];
    const matrixToVisualize =
      rrefState === "viewing" &&
      rrefHistory &&
      rrefStepIndex >= 0 &&
      rrefStepIndex < rrefHistory.length
        ? rrefHistory[rrefStepIndex]
        : initialRrefMatrix;
    if (!matrixToVisualize) return [];
    const planeData = matrixToVisualize
      .map((row, index) => {
        const transform = getPlaneTransformFromRow(row);
        if (transform) {
          const formatNum = (n: number) => n.toFixed(1).replace(".0", "");

          const eqStr = `${formatNum(row[0])}x + ${formatNum(row[1])}y + ${formatNum(row[2])}z = ${formatNum(row[3])}`;
          return {
            id: `rref-plane-${index}-${rrefStepIndex}`,
            position: transform.position,
            rotation: transform.rotation,
            equation: eqStr,
            color: ["#ffaaaa", "#aaffaa", "#aaaaff"][index % 3],
            isValid: transform.isValid,
          };
        }
        return null;
      })
      .filter((p) => p !== null) as {
      id: string;
      position: Vector3;
      rotation: Euler;
      equation: string;
      color: string;
      isValid: boolean;
    }[];
    return planeData;
  }, [mode, rrefState, initialRrefMatrix, rrefHistory, rrefStepIndex]);

  const intersections = useMemo(() => {
    type IntersectionResult = {
      id: string;
      type: "point" | "line";
      data: Vector3 | Line3;
      label: string;
      isSolutionPoint?: boolean;
    };
    const results: IntersectionResult[] = [];

    const activePlanes =
      mode === "rref"
        ? rrefPlaneData
            .filter((pd) => pd.isValid)
            .map((pd) => ({
              id: pd.id,
              type: "plane" as const,
              position: pd.position,
              rotation: pd.rotation,
              visible: true,
              color: "",
              equation: "",
            }))
        : objects.filter((o) => o.visible && o.type === "plane");

    for (let i = 0; i < activePlanes.length; i++) {
      for (let j = i + 1; j < activePlanes.length; j++) {
        const obj1 = activePlanes[i];
        const obj2 = activePlanes[j];
        const pairId = `${obj1.id}-${obj2.id}`;
        let intersectionLine = intersectPlanePlane(obj1, obj2);
        if (intersectionLine) {
          results.push({
            id: `${pairId}-l`,
            type: "line",
            data: intersectionLine.line,
            label: intersectionLine.label,
          });
        }
      }
    }

    if (activePlanes.length >= 3) {
      for (let i = 0; i < activePlanes.length; i++) {
        for (let j = i + 1; j < activePlanes.length; j++) {
          for (let k = j + 1; k < activePlanes.length; k++) {
            const obj1 = activePlanes[i];
            const obj2 = activePlanes[j];
            const obj3 = activePlanes[k];
            const tripletId = `${obj1.id}-${obj2.id}-${obj3.id}`;
            let intersectionPoint = intersectThreePlanes(obj1, obj2, obj3);
            if (intersectionPoint) {
              results.push({
                id: `${tripletId}-p`,
                type: "point",
                data: intersectionPoint.point,
                label: intersectionPoint.label,
                isSolutionPoint: true,
              });
            }
          }
        }
      }
    }

    if (
      mode === "rref" &&
      rrefAnalysis?.solutionType === "unique" &&
      rrefUniqueSolutionPoint
    ) {
      const alreadyFound = results.some(
        (r) =>
          r.isSolutionPoint &&
          (r.data as Vector3).distanceToSquared(rrefUniqueSolutionPoint) <
            SQ_EPSILON
      );
      if (!alreadyFound) {
        results.push({
          id: "rref-solution-pt",
          type: "point",
          data: rrefUniqueSolutionPoint,
          label: `(${rrefUniqueSolutionPoint.x.toFixed(2)}, ${rrefUniqueSolutionPoint.y.toFixed(2)}, ${rrefUniqueSolutionPoint.z.toFixed(2)})`,
          isSolutionPoint: true,
        });
      }
    }

    return results;
  }, [mode, objects, rrefPlaneData, rrefAnalysis, rrefUniqueSolutionPoint]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 5, 3]} intensity={0.5} />
      <CoordinateSystem />

      {mode === "rref" ? (
        <>
          <group scale={[rrefScale, rrefScale, rrefScale]}>
            {rrefPlaneData.map(
              (plane) =>
                plane.isValid && (
                  <MathPlane
                    key={plane.id}
                    id={plane.id}
                    position={plane.position}
                    rotation={plane.rotation}
                    color={plane.color}
                    isSelected={false}
                    equation={plane.equation}
                  />
                )
            )}
            {intersections
              .filter((i) => i.type === "line")
              .map((intersection) => (
                <IntersectionLine
                  key={intersection.id}
                  line={intersection.data as Line3}
                  label={intersection.label}
                />
              ))}
            {intersections
              .filter((i) => i.type === "point")
              .map((intersection) => (
                <IntersectionPoint
                  key={intersection.id}
                  position={intersection.data as Vector3}
                  label={intersection.label}
                />
              ))}
          </group>
          <RrefPanel />
        </>
      ) : (
        <>
          {objects.map(
            (object) =>
              object.visible &&
              object.type === "plane" && (
                <MathPlane
                  key={object.id}
                  id={object.id}
                  position={object.position}
                  rotation={object.rotation}
                  color={object.color}
                  isSelected={object.id === selectedObjectId}
                />
              )
          )}
          {intersections
            .filter((i) => i.type === "line")
            .map((intersection) => (
              <IntersectionLine
                key={intersection.id}
                line={intersection.data as Line3}
                label={intersection.label}
              />
            ))}
          {intersections
            .filter((i) => i.type === "point")
            .map((intersection) => (
              <IntersectionPoint
                key={intersection.id}
                position={intersection.data as Vector3}
                label={intersection.label}
              />
            ))}
          {mode === "random" ? <ControlPanel /> : <EquationPanel />}
        </>
      )}
    </>
  );
};
