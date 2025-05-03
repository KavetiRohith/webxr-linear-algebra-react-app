import { useRef, useEffect, useMemo } from "react";
import { Text, Line } from "@react-three/drei";
import { Interactive } from "@react-three/xr";
import {
  Vector3,
  Euler,
  Quaternion,
  Mesh,
  Plane as ThreePlane,
  Line3,
} from "three";
import { create } from "zustand";
import { generateUUID } from "three/src/math/MathUtils.js";

const EPSILON = 1e-6;
// Using squared epsilon for distance checks
const SQ_EPSILON = EPSILON * EPSILON;

/*************************
 * 1. Zustand Store & Helpers
 *************************/
interface MathObject {
  id: string;
  type: "line" | "plane";
  position: Vector3;
  rotation: Euler;
  color: string;
  equation: string;
  visible: boolean;
}
interface LineEqParams {
  pX: number;
  pY: number;
  pZ: number;
  dX: number;
  dY: number;
  dZ: number;
}
interface PlaneEqParams {
  nX: number;
  nY: number;
  nZ: number;
  d: number;
}
interface LinePlaneStoreState {
  objects: MathObject[];
  selectedObjectId: string | null;
  addLine: (position?: Vector3, rotation?: Euler) => void;
  addPlane: (position?: Vector3, rotation?: Euler) => void;
  removeObject: (id: string) => void;
  updateObjectPosition: (id: string, position: Vector3) => void;
  updateEquation: (id: string) => void;
  selectObject: (id: string | null) => void;
  clearAll: () => void;
  mode: "random" | "equation";
  equationType: "line" | "plane";
  lineParams: LineEqParams;
  planeParams: PlaneEqParams;
  setMode: (mode: "random" | "equation") => void;
  setEquationType: (type: "line" | "plane") => void;
  setLineParam: (param: keyof LineEqParams, value: number) => void;
  setPlaneParam: (param: keyof PlaneEqParams, value: number) => void;
  spawnFromEquation: () => void;
}

const defaultLineParams: LineEqParams = {
  pX: 0,
  pY: 1,
  pZ: 0,
  dX: 1,
  dY: 0,
  dZ: 0,
};

const defaultPlaneParams: PlaneEqParams = { nX: 0, nY: 1, nZ: 0, d: -1 };

const getLineTransform = (
  params: LineEqParams
): { position: Vector3; rotation: Euler } => {
  const position = new Vector3(params.pX, params.pY, params.pZ);
  const direction = new Vector3(params.dX, params.dY, params.dZ);
  if (direction.lengthSq() < SQ_EPSILON) direction.set(1, 0, 0); // Prevent zero vector
  direction.normalize();
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(1, 0, 0),
    direction
  ); // Line mesh along X
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};

const getPlaneTransform = (
  params: PlaneEqParams
): { position: Vector3; rotation: Euler } => {
  const normal = new Vector3(params.nX, params.nY, params.nZ);
  if (normal.lengthSq() < SQ_EPSILON) normal.set(0, 1, 0); // Prevent zero vector
  normal.normalize();
  const position = normal.clone().multiplyScalar(-params.d); // P = -d * N
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    normal
  ); // Plane mesh normal along Z
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};

// Zustand store implementation
export const useLinePlaneStore = create<LinePlaneStoreState>((set, get) => ({
  objects: [],
  selectedObjectId: null,
  mode: "random",
  equationType: "line",
  lineParams: { ...defaultLineParams },
  planeParams: { ...defaultPlaneParams },

  addLine: (position?: Vector3, rotation?: Euler) => {
    if (!position) {
      position = new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.5,
        Math.random() * 2 - 1
      );
    }
    if (!rotation) {
      rotation = new Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
    }
    const id = generateUUID();
    const line = {
      id,
      type: "line" as const,
      position: position.clone(),
      rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "",
      visible: true,
    };
    set((state) => ({
      objects: [...state.objects, line],
      selectedObjectId: id,
    }));
    get().updateEquation(id);
  },

  addPlane: (position?: Vector3, rotation?: Euler) => {
    if (!position) {
      position = new Vector3(
        Math.random() * 2 - 1,
        Math.random() * 1.5,
        Math.random() * 2 - 1
      );
    }
    if (!rotation) {
      rotation = new Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
    }
    const id = generateUUID();
    const plane = {
      id,
      type: "plane" as const,
      position: position.clone(),
      rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "",
      visible: true,
    };

    set((state) => ({
      objects: [...state.objects, plane],
      selectedObjectId: id,
    }));
    get().updateEquation(id);
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
    if (!object) return;
    let equation = "";
    if (object.type === "line") {
      const direction = new Vector3(1, 0, 0)
        .applyEuler(object.rotation)
        .normalize();
      const p0 = object.position;
      equation = `P = (${p0.x.toFixed(1)}, ${p0.y.toFixed(1)}, ${p0.z.toFixed(1)}) + t(${direction.x.toFixed(1)}, ${direction.y.toFixed(1)}, ${direction.z.toFixed(1)})`;
    } else {
      const normal = new Vector3(0, 0, 1)
        .applyEuler(object.rotation)
        .normalize();
      const d = -normal.dot(object.position);
      const formatCoeff = (val: number, axis: string) => {
        if (Math.abs(val) < 0.01) return "";
        const sign = val >= 0 ? "+" : "-";
        const num = Math.abs(val).toFixed(2);
        const numStr = num === "1.00" && axis ? "" : num;
        return ` ${sign} ${numStr}${axis} `;
      };
      const formatD = (val: number) => {
        if (Math.abs(val) < 0.01) return " ";
        const sign = val >= 0 ? "+" : "-";
        const num = Math.abs(val).toFixed(2);
        return ` ${sign} ${num} `;
      };
      let eq =
        `${formatCoeff(normal.x, "x")}${formatCoeff(normal.y, "y")}${formatCoeff(normal.z, "z")}${formatD(d)}= 0`.trim();
      if (eq.startsWith("+ ")) eq = eq.substring(2);
      if (eq.startsWith("- ")) eq = "-" + eq.substring(2);
      equation = eq || "0 = 0";
    }
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

  setMode: (mode) => set({ mode }),

  setEquationType: (type) => set({ equationType: type }),

  setLineParam: (param, value) =>
    set((s) => ({ lineParams: { ...s.lineParams, [param]: value } })),

  setPlaneParam: (param, value) =>
    set((s) => ({ planeParams: { ...s.planeParams, [param]: value } })),

  spawnFromEquation: () => {
    const { equationType, lineParams, planeParams, addLine, addPlane } = get();
    if (equationType === "line") {
      const { position, rotation } = getLineTransform(lineParams);
      addLine(position, rotation);
    } else {
      const { position, rotation } = getPlaneTransform(planeParams);
      addPlane(position, rotation);
    }
  },
}));

/*************************
 * Intersection Math Helpers
 *************************/
const getLineParams = (
  lineObj: MathObject
): { point: Vector3; dir: Vector3 } | null => {
  if (lineObj.type !== "line") return null;
  const point = lineObj.position.clone();
  const dir = new Vector3(1, 0, 0).applyEuler(lineObj.rotation).normalize();
  return { point, dir };
};
const getPlaneParams = (
  planeObj: MathObject
): { normal: Vector3; d: number } | null => {
  if (planeObj.type !== "plane") return null;
  const normal = new Vector3(0, 0, 1).applyEuler(planeObj.rotation).normalize();
  const d = -normal.dot(planeObj.position); // ax + by + cz + d = 0
  return { normal, d }; // Return d directly
};

/**
 * Calculates the intersection point of two 3D lines using the method of minimizing distance.
 * L1: P = P1 + t * D1
 * L2: Q = P2 + s * D2
 */
const intersectLineLine = (
  line1: MathObject,
  line2: MathObject
): { point: Vector3; label: string } | null => {
  const l1 = getLineParams(line1);
  const l2 = getLineParams(line2);
  if (!l1 || !l2) return null;

  const p1 = l1.point;
  const d1 = l1.dir;
  const p2 = l2.point;
  const d2 = l2.dir;
  const w0 = new Vector3().subVectors(p1, p2); // p1 - p2

  const a = d1.dot(d1); // d1 · d1 (>= 0)
  const b = d1.dot(d2); // d1 · d2
  const c = d2.dot(d2); // d2 · d2 (>= 0)
  const d = d1.dot(w0); // d1 · w0
  const e = d2.dot(w0); // d2 · w0

  const det = a * c - b * b; // Determinant (ac - b^2)

  let t1: number, t2: number; // Parameters for L1 and L2

  // If determinant is near zero, lines are parallel
  if (Math.abs(det) < EPSILON) {
    // Check for coincidence (are they the same line?)
    // If parallel, distance from p2 to line 1 should be near zero if coincident
    const distSq = d1.clone().cross(w0).lengthSq() / a; // Squared distance from p2 to L1 = |d1 x (p1-p2)|^2 / |d1|^2
    if (distSq < SQ_EPSILON) {
      // Coincident
      return null;
    } else {
      // Parallel, non-coincident
      return null;
    }
  } else {
    // Lines are not parallel, solve for closest point parameters
    t1 = (b * e - c * d) / det; // Parameter for L1
    t2 = (a * e - b * d) / det; // Parameter for L2
  }

  // Calculate points of closest approach on each line
  const closestPointL1 = p1.clone().addScaledVector(d1, t1);
  const closestPointL2 = p2.clone().addScaledVector(d2, t2);

  // Check if the distance between closest points is near zero (i.e., they intersect)
  if (closestPointL1.distanceToSquared(closestPointL2) < SQ_EPSILON) {
    // Intersect! Return the midpoint for numerical stability.
    const intersectionPoint = closestPointL1.clone().lerp(closestPointL2, 0.5);
    const p = intersectionPoint;
    const label = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
    return { point: p, label: label };
  } else {
    // Lines are skew (non-parallel, non-intersecting)
    return null;
  }
};

/**
 * Calculates intersection between a line and a plane using THREE.Plane.
 * Line: P = P0 + t*D
 * Plane: N · X + d = 0
 */
const intersectLinePlane = (
  lineObj: MathObject,
  planeObj: MathObject
): { point: Vector3; label: string } | null => {
  const lineParams = getLineParams(lineObj);
  const planeParams = getPlaneParams(planeObj); // Gets N and d
  if (!lineParams || !planeParams) return null;

  const { point: linePoint, dir: lineDir } = lineParams;
  const { normal: planeNormal, d: planeD } = planeParams; // Use 'd' directly

  // Create THREE.Plane. NOTE: THREE.Plane uses Ax+By+Cz+D=0 where D is the 'constant'.
  // Our 'd' matches this definition.
  const plane = new ThreePlane(planeNormal, planeD);

  // Check if line is parallel to plane
  const dotDirNormal = lineDir.dot(planeNormal);
  if (Math.abs(dotDirNormal) < EPSILON) {
    // Check if line lies within the plane
    if (Math.abs(plane.distanceToPoint(linePoint)) < EPSILON) {
      // Line lies within the plane
      return null;
    } else {
      // Line is parallel, no intersection
      return null;
    }
  }

  // Line intersects the plane, find the intersection point
  const intersectionPoint = new Vector3();
  // Create a THREE.Line3 representing the infinite line
  const line3 = new Line3(linePoint, linePoint.clone().add(lineDir));
  const result = plane.intersectLine(line3, intersectionPoint);

  if (result) {
    const p = intersectionPoint;
    const label = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;
    return { point: p, label: label };
  } else {
    // Should not happen if dotDirNormal is not zero, but handle anyway
    console.warn("Line-Plane intersection failed unexpectedly.", {
      lineDir,
      planeNormal,
      dotDirNormal,
    });
    return null;
  }
};

/**
 * Calculates intersection line between two planes.
 * P1: N1 · X + d1 = 0
 * P2: N2 · X + d2 = 0
 */
const intersectPlanePlane = (
  plane1Obj: MathObject,
  plane2Obj: MathObject
): { line: Line3; label: string } | null => {
  const p1 = getPlaneParams(plane1Obj); // {normal, d}
  const p2 = getPlaneParams(plane2Obj); // {normal, d}
  if (!p1 || !p2) return null;

  const n1 = p1.normal;
  const d1 = p1.d;
  const n2 = p2.normal;
  const d2 = p2.d;

  // Calculate line direction = N1 x N2
  const lineDirection = new Vector3().crossVectors(n1, n2);

  // Check if planes are parallel or coincident
  if (lineDirection.lengthSq() < SQ_EPSILON) {
    // Check if coincident: distance from origin of plane1 to plane2 should be zero.
    // Need a point on plane1. Let's use the projection of the origin onto the plane: P = -d * N / |N|^2 = -d*N (since N is normalized)
    const pointOnPlane1 = n1.clone().multiplyScalar(-d1);
    const distPlane2 = Math.abs(n2.dot(pointOnPlane1) + d2); // N2·P + d2
    if (distPlane2 < EPSILON) {
      // Coincident
      return null;
    } else {
      // Parallel
      return null;
    }
  }

  lineDirection.normalize(); // Normalize direction vector

  // Find a point P0 on the intersection line.
  // We need to solve the system:
  // N1 · P0 + d1 = 0
  // N2 · P0 + d2 = 0
  // Strategy: Set one coordinate of P0 to 0 and solve for the other two. Try z=0, then y=0, then x=0.

  let linePoint: Vector3 | null = null;

  // Try setting z = 0:
  // n1.x*x + n1.y*y = -d1
  // n2.x*x + n2.y*y = -d2
  let detXY = n1.x * n2.y - n1.y * n2.x;
  if (Math.abs(detXY) > EPSILON) {
    const x = (n1.y * -d2 - n2.y * -d1) / detXY;
    const y = (n2.x * -d1 - n1.x * -d2) / detXY;
    linePoint = new Vector3(x, y, 0);
  } else {
    // Try setting y = 0:
    // n1.x*x + n1.z*z = -d1
    // n2.x*x + n2.z*z = -d2
    let detXZ = n1.x * n2.z - n1.z * n2.x;
    if (Math.abs(detXZ) > EPSILON) {
      const x = (n1.z * -d2 - n2.z * -d1) / detXZ;
      const z = (n2.x * -d1 - n1.x * -d2) / detXZ;
      linePoint = new Vector3(x, 0, z);
    } else {
      // Try setting x = 0:
      // n1.y*y + n1.z*z = -d1
      // n2.y*y + n2.z*z = -d2
      let detYZ = n1.y * n2.z - n1.z * n2.y;
      if (Math.abs(detYZ) > EPSILON) {
        const y = (n1.z * -d2 - n2.z * -d1) / detYZ;
        const z = (n2.y * -d1 - n1.y * -d2) / detYZ;
        linePoint = new Vector3(0, y, z);
      } else {
        // Should not happen if planes aren't parallel, but indicates issue.
        console.warn(
          "Plane-Plane intersection: Could not find a point on the line."
        );
        return null;
      }
    }
  }

  if (!linePoint) return null; // Should already be handled, but for safety

  // Create the parametric equation label P = P0 + t*Direction
  const label = `P = (${linePoint.x.toFixed(1)}, ${linePoint.y.toFixed(1)}, ${linePoint.z.toFixed(1)}) + t(${lineDirection.x.toFixed(1)}, ${lineDirection.y.toFixed(1)}, ${lineDirection.z.toFixed(1)})`;

  // Create a finite Line3 segment centered around the calculated point for visualization
  const segmentLength = 5;
  const halfLength = segmentLength / 2;
  const startPoint = linePoint
    .clone()
    .addScaledVector(lineDirection, -halfLength);
  const endPoint = linePoint.clone().addScaledVector(lineDirection, halfLength);
  const lineSegment = new Line3(startPoint, endPoint);

  return { line: lineSegment, label: label };
};

/*************************
 * Visualization Components (Unchanged from previous version)
 *************************/
// --- Intersection Visuals ---
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
// --- Core Objects ---
const MathLine = ({
  id,
  position,
  rotation,
  color,
  isSelected,
}: {
  id: string;
  position: Vector3;
  rotation: Euler;
  color: string;
  isSelected: boolean;
}) => {
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  const lineRef = useRef<Mesh>(null);
  const handleRef = useRef<Mesh>(null);
  const isDraggingRef = useRef(false);
  const dragStartPointRef = useRef<Vector3 | null>(null);
  const objectStartPositionRef = useRef<Vector3 | null>(null);
  const handleSelect = () => {
    selectObject(id);
  };
  const equation = useLinePlaneStore(
    (state) => state.objects.find((obj) => obj.id === id)?.equation
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh ref={lineRef} onClick={handleSelect}>
        <cylinderGeometry args={[0.01, 0.01, 2, 8]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.8 : 0.5}
          transparent
        />
      </mesh>
      <mesh
        ref={handleRef}
        position={[0, 0, 0]}
        onClick={handleSelect}
        onPointerDown={(e) => {
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation();
            isDraggingRef.current = true;
            dragStartPointRef.current = e.point.clone();
            objectStartPositionRef.current = position.clone();
          }
        }}
        onPointerMove={(e) => {
          if (
            isSelected &&
            isDraggingRef.current &&
            dragStartPointRef.current &&
            objectStartPositionRef.current
          ) {
            e.stopPropagation();
            const dragDelta = new Vector3().subVectors(
              e.point,
              dragStartPointRef.current
            );
            const newPosition = objectStartPositionRef.current
              .clone()
              .add(dragDelta);
            updateObjectPosition(id, newPosition);
          }
        }}
        onPointerUp={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
          }
        }}
        onPointerLeave={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
          }
        }}
      >
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial
          color={isSelected ? "#ffffff" : color}
          opacity={0.8}
          transparent
        />
      </mesh>
      <Text
        position={[0, 0.1, 0]}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="bottom"
      >
        {equation || ""}
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
}: {
  id: string;
  position: Vector3;
  rotation: Euler;
  color: string;
  isSelected: boolean;
}) => {
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  const meshRef = useRef<Mesh>(null);
  const isDraggingRef = useRef(false);
  const handleSelect = () => {
    selectObject(id);
  };
  const equation = useLinePlaneStore(
    (state) => state.objects.find((obj) => obj.id === id)?.equation
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={meshRef}
        onClick={handleSelect}
        onPointerDown={(e) => {
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation();
            isDraggingRef.current = true;
          }
        }}
        onPointerMove={(e) => {
          if (isSelected && isDraggingRef.current) {
            e.stopPropagation();
            updateObjectPosition(id, e.point);
          }
        }}
        onPointerUp={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
          }
        }}
        onPointerLeave={(e) => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
          }
        }}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.7 : 0.4}
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
        {equation || ""}
      </Text>
    </group>
  );
};
// --- Environment & UI ---
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
}: {
  label: string;
  position: [number, number, number];
  onSelect: () => void;
  color?: string;
  width?: number;
  height?: number;
  fontSize?: number;
}) => (
  <Interactive onSelect={onSelect}>
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 0, 0.001]}
        fontSize={fontSize}
        color="white"
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
  paramKey,
  min,
  max,
  onChange,
  yPos,
}: {
  label: string;
  value: number;
  paramKey: keyof LineEqParams | keyof PlaneEqParams;
  min: number;
  max: number;
  onChange: (key: any, value: number) => void;
  yPos: number;
}) => {
  const buttonSize = 0.03;
  const spacing = 0.01;
  const barWidth = 0.25;
  const increment = 0.5;
  const handleDecrement = () => {
    onChange(paramKey, Math.max(min, value - increment));
  };
  const handleIncrement = () => {
    onChange(paramKey, Math.min(max, value + increment));
  };
  return (
    <group position={[0, yPos, 0.01]}>
      <Text
        position={[-barWidth / 2 - spacing, 0, 0]}
        fontSize={0.018}
        color="white"
        anchorX="right"
        anchorY="middle"
      >
        {label}:
      </Text>
      <Text
        position={[0, 0, 0]}
        fontSize={0.02}
        color="yellow"
        anchorX="center"
        anchorY="middle"
      >
        {value.toFixed(1)}
      </Text>
      <Interactive onSelect={handleDecrement}>
        <mesh position={[-buttonSize - spacing * 3, 0, 0]}>
          <planeGeometry args={[buttonSize, buttonSize]} />
          <meshStandardMaterial color="#b55" side={2} />
        </mesh>
        <Text
          position={[-buttonSize - spacing * 3, 0, 0.001]}
          fontSize={0.02}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          -
        </Text>
      </Interactive>
      <Interactive onSelect={handleIncrement}>
        <mesh position={[buttonSize + spacing * 3, 0, 0]}>
          <planeGeometry args={[buttonSize, buttonSize]} />
          <meshStandardMaterial color="#5b5" side={2} />
        </mesh>
        <Text
          position={[buttonSize + spacing * 3, 0, 0.001]}
          fontSize={0.02}
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
  const {
    selectedObjectId,
    addLine,
    addPlane,
    removeObject,
    clearAll,
    setMode,
  } = useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  const handleClearAll = () => {
    clearAll();
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
        label="Add Random Line"
        position={[0, 0.11, 0.01]}
        onSelect={() => addLine()}
      />
      <PanelButton
        label="Add Random Plane"
        position={[0, 0.06, 0.01]}
        onSelect={() => addPlane()}
      />
      {selectedObjectId && (
        <PanelButton
          label="Delete Selected"
          position={[0, 0.01, 0.01]}
          onSelect={() => removeObject(selectedObjectId)}
          color="#a44"
        />
      )}
      <PanelButton
        label="Clear All"
        position={[0, -0.04, 0.01]}
        onSelect={handleClearAll}
        color="#6f2ca5"
      />
      <PanelButton
        label="Enter Equation Mode"
        position={[0, -0.12, 0.01]}
        onSelect={() => setMode("equation")}
        color="#276"
        width={0.35}
      />
    </group>
  );
};
const EquationPanel = () => {
  const {
    equationType,
    lineParams,
    planeParams,
    setEquationType,
    setLineParam,
    setPlaneParam,
    spawnFromEquation,
    setMode,
  } = useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  const sliderProps = { min: -5, max: 5 };
  const normalSliderProps = { min: -1, max: 1 };
  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh>
        <planeGeometry args={[0.45, 0.6]} />
        <meshStandardMaterial
          color="#2a224a"
          transparent
          opacity={0.85}
          side={2}
        />
      </mesh>
      <Text
        position={[0, 0.27, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        Define Equation
      </Text>
      <PanelButton
        label="Line"
        position={[-0.1, 0.22, 0.01]}
        width={0.15}
        height={0.035}
        fontSize={0.018}
        onSelect={() => setEquationType("line")}
        color={equationType === "line" ? "#66a" : "#446"}
      />
      <PanelButton
        label="Plane"
        position={[0.1, 0.22, 0.01]}
        width={0.15}
        height={0.035}
        fontSize={0.018}
        onSelect={() => setEquationType("plane")}
        color={equationType === "plane" ? "#66a" : "#446"}
      />
      {equationType === "line" ? (
        <>
          <Text
            position={[-0.2, 0.17, 0.01]}
            fontSize={0.018}
            color="lightblue"
            anchorX="left"
          >
            Point (pX, pY, pZ)
          </Text>
          <ValueAdjuster
            label="pX"
            value={lineParams.pX}
            paramKey="pX"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.13}
          />
          <ValueAdjuster
            label="pY"
            value={lineParams.pY}
            paramKey="pY"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.09}
          />
          <ValueAdjuster
            label="pZ"
            value={lineParams.pZ}
            paramKey="pZ"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.05}
          />
          <Text
            position={[-0.2, 0.0, 0.01]}
            fontSize={0.018}
            color="lightgreen"
            anchorX="left"
          >
            Direction (dX, dY, dZ)
          </Text>
          <ValueAdjuster
            label="dX"
            value={lineParams.dX}
            paramKey="dX"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.04}
          />
          <ValueAdjuster
            label="dY"
            value={lineParams.dY}
            paramKey="dY"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.08}
          />
          <ValueAdjuster
            label="dZ"
            value={lineParams.dZ}
            paramKey="dZ"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.12}
          />
        </>
      ) : (
        <>
          <Text
            position={[-0.2, 0.17, 0.01]}
            fontSize={0.018}
            color="salmon"
            anchorX="left"
          >
            Normal (nX, nY, nZ)
          </Text>
          <ValueAdjuster
            label="nX"
            value={planeParams.nX}
            paramKey="nX"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.13}
          />
          <ValueAdjuster
            label="nY"
            value={planeParams.nY}
            paramKey="nY"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.09}
          />
          <ValueAdjuster
            label="nZ"
            value={planeParams.nZ}
            paramKey="nZ"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.05}
          />
          <Text
            position={[-0.2, 0.0, 0.01]}
            fontSize={0.018}
            color="gold"
            anchorX="left"
          >
            Constant (d)
          </Text>
          <ValueAdjuster
            label="d"
            value={planeParams.d}
            paramKey="d"
            {...sliderProps}
            onChange={setPlaneParam}
            yPos={-0.04}
          />
        </>
      )}
      <PanelButton
        label="Spawn Object"
        position={[0, -0.19, 0.01]}
        onSelect={spawnFromEquation}
        color="#2a5"
        width={0.25}
      />
      <PanelButton
        label="Back to Controls"
        position={[0, -0.24, 0.01]}
        onSelect={() => setMode("random")}
        color="#777"
        width={0.25}
      />
    </group>
  );
};

/*************************
 * 4. Main AR Scene Component (using revised intersection helpers)
 *************************/
export const ARScene = () => {
  const { objects, selectedObjectId, mode } = useLinePlaneStore();
  useEffect(() => {
    if (useLinePlaneStore.getState().objects.length === 0) {
      console.log("Seeding initial objects...");
      useLinePlaneStore.getState().addLine();
      useLinePlaneStore.getState().addPlane();
    }
  }, []);

  // Calculate intersections using revised helpers
  const intersections = useMemo(() => {
    // console.log("Recalculating intersections..."); // Less verbose logging
    type IntersectionResult = {
      id: string;
      type: "point" | "line";
      data: Vector3 | Line3;
      label: string;
    };
    const results: IntersectionResult[] = [];
    const visibleObjects = objects.filter((o) => o.visible);

    for (let i = 0; i < visibleObjects.length; i++) {
      for (let j = i + 1; j < visibleObjects.length; j++) {
        const obj1 = visibleObjects[i];
        const obj2 = visibleObjects[j];
        const pairId = `${obj1.id}-${obj2.id}`;
        let intersectionCalcResult:
          | { point: Vector3; label: string }
          | { line: Line3; label: string }
          | null = null;

        // Calls to revised intersection functions
        if (obj1.type === "line" && obj2.type === "line") {
          intersectionCalcResult = intersectLineLine(obj1, obj2);
          if (intersectionCalcResult) {
            results.push({
              id: `${pairId}-p`,
              type: "point",
              data: intersectionCalcResult.point,
              label: intersectionCalcResult.label,
            });
          }
        } else if (obj1.type === "line" && obj2.type === "plane") {
          intersectionCalcResult = intersectLinePlane(obj1, obj2);
          if (intersectionCalcResult && "point" in intersectionCalcResult) {
            results.push({
              id: `${pairId}-p`,
              type: "point",
              data: intersectionCalcResult.point,
              label: intersectionCalcResult.label,
            });
          }
        } else if (obj1.type === "plane" && obj2.type === "line") {
          intersectionCalcResult = intersectLinePlane(obj2, obj1);
          if (intersectionCalcResult && "point" in intersectionCalcResult) {
            results.push({
              id: `${pairId}-p`,
              type: "point",
              data: intersectionCalcResult.point,
              label: intersectionCalcResult.label,
            });
          }
        } else if (obj1.type === "plane" && obj2.type === "plane") {
          intersectionCalcResult = intersectPlanePlane(obj1, obj2);
          if (intersectionCalcResult && "line" in intersectionCalcResult) {
            results.push({
              id: `${pairId}-l`,
              type: "line",
              data: intersectionCalcResult.line,
              label: intersectionCalcResult.label,
            });
          }
        }
      }
    }
    // console.log(`Found ${results.length} intersections.`); // Less verbose logging
    return results;
  }, [objects]);

  return (
    <>
      {/* Lighting & Environment */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 5, 3]} intensity={0.5} />
      <CoordinateSystem />
      {/* Render Math Objects */}
      {objects.map(
        (object) =>
          object.visible &&
          (object.type === "line" ? (
            <MathLine
              key={object.id}
              id={object.id}
              position={object.position}
              rotation={object.rotation}
              color={object.color}
              isSelected={object.id === selectedObjectId}
            />
          ) : (
            <MathPlane
              key={object.id}
              id={object.id}
              position={object.position}
              rotation={object.rotation}
              color={object.color}
              isSelected={object.id === selectedObjectId}
            />
          ))
      )}
      {/* Render Intersections */}
      {intersections.map((intersection) =>
        intersection.type === "point" ? (
          <IntersectionPoint
            key={intersection.id}
            position={intersection.data as Vector3}
            label={intersection.label}
          />
        ) : (
          <IntersectionLine
            key={intersection.id}
            line={intersection.data as Line3}
            label={intersection.label}
          />
        )
      )}
      {/* Conditionally Render Control Panels */}
      {mode === "random" ? <ControlPanel /> : <EquationPanel />}
    </>
  );
};
