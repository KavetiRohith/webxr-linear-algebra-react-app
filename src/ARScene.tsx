import { useRef, useEffect, useMemo } from "react";
import { Text, Line } from "@react-three/drei";
import { Interactive } from "@react-three/xr";
import { Vector3, Euler, Quaternion, Mesh } from "three";
import { create } from "zustand";
import { generateUUID } from "three/src/math/MathUtils.js";

// Store, helpers, Equation Params, transform functions - remain the same as the previous version
// ... (Keep the Zustand store definition, defaults, getLineTransform, getPlaneTransform from the previous correct version) ...
// Definition repeated here for completeness, ensure it matches the PREVIOUS correct version
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
  clearAll: () => void; // Added clearAll
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
  if (direction.lengthSq() < 0.0001) direction.set(1, 0, 0);
  direction.normalize();
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(1, 0, 0),
    direction
  );
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};
const getPlaneTransform = (
  params: PlaneEqParams
): { position: Vector3; rotation: Euler } => {
  const normal = new Vector3(params.nX, params.nY, params.nZ);
  if (normal.lengthSq() < 0.0001) normal.set(0, 1, 0);
  normal.normalize();
  const position = normal.clone().multiplyScalar(-params.d);
  const quaternion = new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    normal
  );
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};

// Zustand store implementation (ensure actions match the previous correct version where interaction was copied)
export const useLinePlaneStore = create<LinePlaneStoreState>((set, get) => ({
  objects: [],
  selectedObjectId: null,
  mode: "random",
  equationType: "line",
  lineParams: { ...defaultLineParams },
  planeParams: { ...defaultPlaneParams },

  // --- Original Actions (copied again for certainty) ---
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
    get().updateEquation(id); // Call equation update after position update
  },
  updateEquation: (id) => {
    const object = get().objects.find((obj) => obj.id === id);
    if (!object) return;
    let equation = "";
    if (object.type === "line") {
      const direction = new Vector3(1, 0, 0)
        .applyEuler(object.rotation)
        .normalize();
      equation = `P = (${object.position.x.toFixed(1)}, ${object.position.y.toFixed(1)}, ${object.position.z.toFixed(1)}) + t(${direction.x.toFixed(1)}, ${direction.y.toFixed(1)}, ${direction.z.toFixed(1)})`;
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
    console.log("Selecting object:", id); // Add log for debugging
    set({ selectedObjectId: id });
  },
  clearAll: () => set({ objects: [], selectedObjectId: null }), // Add clearAll back
  // --- Equation Mode Actions ---
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
 * 2.  Scene Helpers & Components
 *************************/

// CoordinateSystem (Unchanged)
const CoordinateSystem = () => (
  <group>
    {" "}
    <mesh position={[0, 0, 0]}>
      {" "}
      <sphereGeometry args={[0.03]} />{" "}
      <meshStandardMaterial color="#ffffff" />{" "}
    </mesh>{" "}
    <Line
      points={[
        [0, 0, 0],
        [1, 0, 0],
      ]}
      color="red"
      lineWidth={2}
    />{" "}
    <Text position={[1.1, 0, 0]} fontSize={0.05} color="red">
      X
    </Text>{" "}
    <Line
      points={[
        [0, 0, 0],
        [0, 1, 0],
      ]}
      color="green"
      lineWidth={2}
    />{" "}
    <Text position={[0, 1.1, 0]} fontSize={0.05} color="green">
      Y
    </Text>{" "}
    <Line
      points={[
        [0, 0, 0],
        [0, 0, 1],
      ]}
      color="blue"
      lineWidth={2}
    />{" "}
    <Text position={[0, 0, 1.1]} fontSize={0.05} color="blue">
      Z
    </Text>{" "}
    <gridHelper args={[4, 20, "#555", "#333"]} position={[0, -0.01, 0]} />{" "}
  </group>
);

// ==================================================================
// START: MathLine - STRICTLY ADHERING TO ORIGINAL EVENT LOGIC
// ==================================================================
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
  // Use actions from the store
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  // Refs for meshes and drag state - exactly as in original
  const lineRef = useRef<Mesh>(null);
  const handleRef = useRef<Mesh>(null); // The sphere used for interaction
  const isDraggingRef = useRef(false);
  const dragStartPointRef = useRef<Vector3 | null>(null); // World space point where drag started ON the handle
  const objectStartPositionRef = useRef<Vector3 | null>(null); // Object's world position when drag started

  // Selection handler - exactly as in original
  const handleSelect = () => {
    console.log(`MathLine (${id}): handleSelect called`); // Debug log
    selectObject(id);
  };

  // Get equation dynamically for text display
  const equation = useLinePlaneStore(
    (state) => state.objects.find((obj) => obj.id === id)?.equation
  );

  // Event handlers attached to the handleRef mesh, matching original logic
  return (
    <group position={position} rotation={rotation}>
      {/* Visible Line representation - attach select handler here too */}
      <mesh ref={lineRef} onClick={handleSelect}>
        <cylinderGeometry args={[0.01, 0.01, 2, 8]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.8 : 0.5}
          transparent
        />
      </mesh>

      {/* Dedicated handle (sphere) for selection and dragging */}
      <mesh
        ref={handleRef}
        position={[0, 0, 0]} // Position handle at the object's origin (same as group)
        // onClick for selection
        onClick={handleSelect} // Use the same selection handler
        // onPointerDown to initiate drag - LOGIC FROM ORIGINAL
        onPointerDown={(e) => {
          console.log(
            `MathLine (${id}): onPointerDown. isSelected: ${isSelected}, isDragging: ${isDraggingRef.current}`
          ); // Debug log
          // Check selection status *before* starting drag
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation(); // Prevent events on underlying objects
            isDraggingRef.current = true;
            dragStartPointRef.current = e.point.clone(); // World space intersection
            objectStartPositionRef.current = position.clone(); // Current object position
            console.log(
              `MathLine (${id}): Drag started. StartPoint: ${dragStartPointRef.current?.toArray()}, StartPos: ${objectStartPositionRef.current?.toArray()}`
            ); // Debug log
            // NO POINTER CAPTURE (as per original code provided)
          }
        }}
        // onPointerMove for dragging - LOGIC FROM ORIGINAL
        onPointerMove={(e) => {
          // Check selection and dragging status
          if (
            isSelected &&
            isDraggingRef.current &&
            dragStartPointRef.current &&
            objectStartPositionRef.current
          ) {
            e.stopPropagation();
            // Calculate delta and new position - LOGIC FROM ORIGINAL
            const dragDelta = new Vector3().subVectors(
              e.point,
              dragStartPointRef.current
            );
            const newPosition = objectStartPositionRef.current
              .clone()
              .add(dragDelta);
            // Update store
            updateObjectPosition(id, newPosition);
          }
        }}
        // onPointerUp to end drag - LOGIC FROM ORIGINAL
        onPointerUp={(e) => {
          // Event param 'e' might be needed for stopPropagation if added later
          if (isDraggingRef.current) {
            // Only reset if currently dragging
            console.log(`MathLine (${id}): onPointerUp`); // Debug log
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
            // NO POINTER CAPTURE RELEASE
          }
        }}
        // onPointerLeave to end drag - LOGIC FROM ORIGINAL
        onPointerLeave={(e) => {
          // Event param 'e' might be needed
          if (isDraggingRef.current) {
            // Only reset if currently dragging
            console.log(`MathLine (${id}): onPointerLeave`); // Debug log
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
            // NO POINTER CAPTURE RELEASE
          }
        }}
      >
        {/* Geometry and Material FOR HANDLE - FROM ORIGINAL */}
        <sphereGeometry args={[0.05]} /> {/* Small sphere handle */}
        <meshStandardMaterial
          color={isSelected ? "#ffffff" : color} // White when selected, object color otherwise
          opacity={0.8}
          transparent
          // Make handle always visible or only when selected? Original implies always visible? Let's make it always visible but change color.
          // visible={isSelected} // Original seemed to only show handle when selected? Let's try always visible for easier interaction.
        />
      </mesh>

      {/* Display equation */}
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
// ==============================================================
// END: MathLine - STRICTLY ADHERING TO ORIGINAL EVENT LOGIC
// ==============================================================

// =================================================================
// START: MathPlane - STRICTLY ADHERING TO ORIGINAL EVENT LOGIC
// =================================================================
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
  // Use actions from the store
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  // Refs for mesh and drag state - exactly as in original
  const meshRef = useRef<Mesh>(null);
  const isDraggingRef = useRef(false);

  // Selection handler - exactly as in original
  const handleSelect = () => {
    console.log(`MathPlane (${id}): handleSelect called`); // Debug log
    selectObject(id);
  };

  // Get equation dynamically for text display
  const equation = useLinePlaneStore(
    (state) => state.objects.find((obj) => obj.id === id)?.equation
  );

  // Event handlers attached directly to the plane mesh, matching original logic
  return (
    <group position={position} rotation={rotation}>
      {/* Plane representation */}
      <mesh
        ref={meshRef}
        // onClick for selection - LOGIC FROM ORIGINAL
        onClick={handleSelect}
        // onPointerDown to initiate drag - LOGIC FROM ORIGINAL
        onPointerDown={(e) => {
          console.log(
            `MathPlane (${id}): onPointerDown. isSelected: ${isSelected}, isDragging: ${isDraggingRef.current}`
          ); // Debug log
          // Check selection status *before* starting drag
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation(); // Prevent events on underlying objects
            isDraggingRef.current = true;
            console.log(`MathPlane (${id}): Drag started.`); // Debug log
            // NO POINTER CAPTURE
            // Optional immediate move from original not included here, wait for move event
          }
        }}
        // onPointerMove for dragging - LOGIC FROM ORIGINAL
        onPointerMove={(e) => {
          // Check selection and dragging status
          if (isSelected && isDraggingRef.current) {
            e.stopPropagation();
            // Update position directly to intersection point - LOGIC FROM ORIGINAL
            updateObjectPosition(id, e.point);
          }
        }}
        // onPointerUp to end drag - LOGIC FROM ORIGINAL
        onPointerUp={(e) => {
          // Event param 'e' might be needed
          if (isDraggingRef.current) {
            // Only reset if currently dragging
            console.log(`MathPlane (${id}): onPointerUp`); // Debug log
            isDraggingRef.current = false;
            // NO POINTER CAPTURE RELEASE
          }
        }}
        // onPointerLeave to end drag - LOGIC FROM ORIGINAL
        onPointerLeave={(e) => {
          // Event param 'e' might be needed
          if (isDraggingRef.current) {
            // Only reset if currently dragging
            console.log(`MathPlane (${id}): onPointerLeave`); // Debug log
            isDraggingRef.current = false;
            // NO POINTER CAPTURE RELEASE
          }
        }}
      >
        {/* Geometry and Material - FROM ORIGINAL */}
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.7 : 0.4}
          transparent
          side={2} // DoubleSide
          // Add emissive effect from previous version for better feedback
          emissive={isSelected ? color : undefined}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Display equation - Adjusted position relative to plane */}
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
// ===============================================================
// END: MathPlane - STRICTLY ADHERING TO ORIGINAL EVENT LOGIC
// ===============================================================

// --- Panel Button Component (Unchanged) ---
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
    {" "}
    <group position={position}>
      {" "}
      <mesh>
        {" "}
        <planeGeometry args={[width, height]} />{" "}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.9}
          side={2}
        />{" "}
      </mesh>{" "}
      <Text
        position={[0, 0, 0.001]}
        fontSize={fontSize}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {" "}
        {label}{" "}
      </Text>{" "}
    </group>{" "}
  </Interactive>
);

// --- Value Adjuster Component (+/- buttons, Unchanged) ---
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
  const increment = 0.25;
  const handleDecrement = () => {
    onChange(paramKey, Math.max(min, value - increment));
  };
  const handleIncrement = () => {
    onChange(paramKey, Math.min(max, value + increment));
  };
  return (
    <group position={[0, yPos, 0.01]}>
      {" "}
      <Text
        position={[-barWidth / 2 - spacing, 0, 0]}
        fontSize={0.018}
        color="white"
        anchorX="right"
        anchorY="middle"
      >
        {" "}
        {label}:{" "}
      </Text>{" "}
      <Text
        position={[0, 0, 0]}
        fontSize={0.02}
        color="yellow"
        anchorX="center"
        anchorY="middle"
      >
        {" "}
        {value.toFixed(1)}{" "}
      </Text>{" "}
      <Interactive onSelect={handleDecrement}>
        {" "}
        <mesh position={[-buttonSize - spacing * 3, 0, 0]}>
          {" "}
          <planeGeometry args={[buttonSize, buttonSize]} />{" "}
          <meshStandardMaterial color="#b55" side={2} />{" "}
        </mesh>{" "}
        <Text
          position={[-buttonSize - spacing * 3, 0, 0.001]}
          fontSize={0.02}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {" "}
          -{" "}
        </Text>{" "}
      </Interactive>{" "}
      <Interactive onSelect={handleIncrement}>
        {" "}
        <mesh position={[buttonSize + spacing * 3, 0, 0]}>
          {" "}
          <planeGeometry args={[buttonSize, buttonSize]} />{" "}
          <meshStandardMaterial color="#5b5" side={2} />{" "}
        </mesh>{" "}
        <Text
          position={[buttonSize + spacing * 3, 0, 0.001]}
          fontSize={0.02}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {" "}
          +{" "}
        </Text>{" "}
      </Interactive>{" "}
    </group>
  );
};

// --- Control Panel (Unchanged) ---
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
      {" "}
      <mesh>
        {" "}
        <planeGeometry args={[0.4, 0.4]} />{" "}
        <meshStandardMaterial
          color="#22224a"
          transparent
          opacity={0.8}
          side={2}
        />{" "}
      </mesh>{" "}
      <Text
        position={[0, 0.17, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {" "}
        Controls{" "}
      </Text>{" "}
      <PanelButton
        label="Add Random Line"
        position={[0, 0.11, 0.01]}
        onSelect={() => addLine()}
      />{" "}
      <PanelButton
        label="Add Random Plane"
        position={[0, 0.06, 0.01]}
        onSelect={() => addPlane()}
      />{" "}
      {selectedObjectId && (
        <PanelButton
          label="Delete Selected"
          position={[0, 0.01, 0.01]}
          onSelect={() => removeObject(selectedObjectId)}
          color="#a44"
        />
      )}{" "}
      <PanelButton
        label="Clear All"
        position={[0, -0.04, 0.01]}
        onSelect={handleClearAll}
        color="#6f2ca5"
      />{" "}
      <PanelButton
        label="Enter Equation Mode"
        position={[0, -0.12, 0.01]}
        onSelect={() => setMode("equation")}
        color="#276"
        width={0.35}
      />{" "}
    </group>
  );
};

// --- Equation Panel (Unchanged) ---
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
      {" "}
      <mesh>
        {" "}
        <planeGeometry args={[0.45, 0.6]} />{" "}
        <meshStandardMaterial
          color="#2a224a"
          transparent
          opacity={0.85}
          side={2}
        />{" "}
      </mesh>{" "}
      <Text
        position={[0, 0.27, 0.01]}
        fontSize={0.025}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {" "}
        Define Equation{" "}
      </Text>{" "}
      <PanelButton
        label="Line"
        position={[-0.1, 0.22, 0.01]}
        width={0.15}
        height={0.035}
        fontSize={0.018}
        onSelect={() => setEquationType("line")}
        color={equationType === "line" ? "#66a" : "#446"}
      />{" "}
      <PanelButton
        label="Plane"
        position={[0.1, 0.22, 0.01]}
        width={0.15}
        height={0.035}
        fontSize={0.018}
        onSelect={() => setEquationType("plane")}
        color={equationType === "plane" ? "#66a" : "#446"}
      />{" "}
      {equationType === "line" ? (
        <>
          {" "}
          <Text
            position={[-0.2, 0.17, 0.01]}
            fontSize={0.018}
            color="lightblue"
            anchorX="left"
          >
            Point (pX, pY, pZ)
          </Text>{" "}
          <ValueAdjuster
            label="pX"
            value={lineParams.pX}
            paramKey="pX"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.13}
          />{" "}
          <ValueAdjuster
            label="pY"
            value={lineParams.pY}
            paramKey="pY"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.09}
          />{" "}
          <ValueAdjuster
            label="pZ"
            value={lineParams.pZ}
            paramKey="pZ"
            {...sliderProps}
            onChange={setLineParam}
            yPos={0.05}
          />{" "}
          <Text
            position={[-0.2, 0.0, 0.01]}
            fontSize={0.018}
            color="lightgreen"
            anchorX="left"
          >
            Direction (dX, dY, dZ)
          </Text>{" "}
          <ValueAdjuster
            label="dX"
            value={lineParams.dX}
            paramKey="dX"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.04}
          />{" "}
          <ValueAdjuster
            label="dY"
            value={lineParams.dY}
            paramKey="dY"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.08}
          />{" "}
          <ValueAdjuster
            label="dZ"
            value={lineParams.dZ}
            paramKey="dZ"
            {...normalSliderProps}
            onChange={setLineParam}
            yPos={-0.12}
          />{" "}
        </>
      ) : (
        <>
          {" "}
          <Text
            position={[-0.2, 0.17, 0.01]}
            fontSize={0.018}
            color="salmon"
            anchorX="left"
          >
            Normal (nX, nY, nZ)
          </Text>{" "}
          <ValueAdjuster
            label="nX"
            value={planeParams.nX}
            paramKey="nX"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.13}
          />{" "}
          <ValueAdjuster
            label="nY"
            value={planeParams.nY}
            paramKey="nY"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.09}
          />{" "}
          <ValueAdjuster
            label="nZ"
            value={planeParams.nZ}
            paramKey="nZ"
            {...normalSliderProps}
            onChange={setPlaneParam}
            yPos={0.05}
          />{" "}
          <Text
            position={[-0.2, 0.0, 0.01]}
            fontSize={0.018}
            color="gold"
            anchorX="left"
          >
            Constant (d)
          </Text>{" "}
          <ValueAdjuster
            label="d"
            value={planeParams.d}
            paramKey="d"
            {...sliderProps}
            onChange={setPlaneParam}
            yPos={-0.04}
          />{" "}
        </>
      )}{" "}
      <PanelButton
        label="Spawn Object"
        position={[0, -0.19, 0.01]}
        onSelect={spawnFromEquation}
        color="#2a5"
        width={0.25}
      />{" "}
      <PanelButton
        label="Back to Controls"
        position={[0, -0.24, 0.01]}
        onSelect={() => setMode("random")}
        color="#777"
        width={0.25}
      />{" "}
    </group>
  );
};

/*************************
 * 3.  Main Scene (Renders objects with corrected interaction)
 *************************/
export const ARScene = () => {
  const { objects, selectedObjectId, mode } = useLinePlaneStore();

  // Initialize with a line and plane (Unchanged)
  useEffect(() => {
    if (useLinePlaneStore.getState().objects.length === 0) {
      console.log("Seeding initial objects...");
      useLinePlaneStore.getState().addLine();
      useLinePlaneStore.getState().addPlane();
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 5, 3]} intensity={0.5} />
      <CoordinateSystem />

      {/* Render Math Objects using the updated components */}
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

      {/* Conditionally Render Fixed Panels (Unchanged) */}
      {mode === "random" ? <ControlPanel /> : <EquationPanel />}
    </>
  );
};
