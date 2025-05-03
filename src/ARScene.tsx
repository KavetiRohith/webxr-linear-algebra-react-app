// ARScene.tsx - FINAL ATTEMPT: Restore Original Interaction + Equation Editor
// ------------------------------------------------------------------
import { useRef, useEffect, useMemo } from "react";
import { Text, Line } from "@react-three/drei";
import { Interactive } from "@react-three/xr"; // Keep Interactive for panel buttons
import { Vector3, Euler, Quaternion, Mesh } from "three"; // Added Mesh
import { create } from "zustand";
import { generateUUID } from "three/src/math/MathUtils.js";

/*************************
 * 1.  Zustand Store (Merging Original Object Logic with Equation Mode State)
 *************************/

interface MathObject { // Changed type name back to original for consistency
  id: string;
  type: "line" | "plane";
  position: Vector3;
  rotation: Euler;
  color: string;
  equation: string;
  visible: boolean;
}

// Equation Param types (from previous version)
interface LineEqParams { pX: number; pY: number; pZ: number; dX: number; dY: number; dZ: number; }
interface PlaneEqParams { nX: number; nY: number; nZ: number; d: number; }

// Merged Store State
interface LinePlaneStoreState { // Changed type name back to original
  objects: MathObject[];
  selectedObjectId: string | null;

  // --- Original Object Actions (Directly from working code) ---
  addLine: (position?: Vector3, rotation?: Euler) => void;
  addPlane: (position?: Vector3, rotation?: Euler) => void;
  removeObject: (id: string) => void;
  updateObjectPosition: (id: string, position: Vector3) => void;
  // updateObjectRotation: (id: string, rotation: Euler) => void; // Not strictly needed for drag, but keep if rotation manipulation is added later
  updateEquation: (id: string) => void; // Original separate equation update
  selectObject: (id: string | null) => void;
  // toggleVisibility: (id: string) => void; // Keep if needed

  // --- Equation Mode State & Actions (From previous version) ---
  mode: 'random' | 'equation';
  equationType: 'line' | 'plane';
  lineParams: LineEqParams;
  planeParams: PlaneEqParams;
  setMode: (mode: 'random' | 'equation') => void;
  setEquationType: (type: 'line' | 'plane') => void;
  setLineParam: (param: keyof LineEqParams, value: number) => void;
  setPlaneParam: (param: keyof PlaneEqParams, value: number) => void;
  spawnFromEquation: () => void;
  clearAll: () => void;
}

// Default parameters (from previous version)
const defaultLineParams: LineEqParams = { pX: 0, pY: 1, pZ: 0, dX: 1, dY: 0, dZ: 0 };
const defaultPlaneParams: PlaneEqParams = { nX: 0, nY: 1, nZ: 0, d: -1 };

// Transform helpers (from previous version)
const getLineTransform = (params: LineEqParams): { position: Vector3; rotation: Euler } => {
  const position = new Vector3(params.pX, params.pY, params.pZ);
  const direction = new Vector3(params.dX, params.dY, params.dZ);
  if (direction.lengthSq() < 0.0001) direction.set(1, 0, 0);
  direction.normalize();
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), direction);
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};
const getPlaneTransform = (params: PlaneEqParams): { position: Vector3; rotation: Euler } => {
  const normal = new Vector3(params.nX, params.nY, params.nZ);
  if (normal.lengthSq() < 0.0001) normal.set(0, 1, 0);
  normal.normalize();
  const position = normal.clone().multiplyScalar(-params.d);
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
  const rotation = new Euler().setFromQuaternion(quaternion);
  return { position, rotation };
};


export const useLinePlaneStore = create<LinePlaneStoreState>((set, get) => ({
  objects: [],
  selectedObjectId: null,
  // Equation mode defaults
  mode: 'random',
  equationType: 'line',
  lineParams: { ...defaultLineParams },
  planeParams: { ...defaultPlaneParams },

  // ==============================================================
  // START: Actions copied EXACTLY from the original working code
  // ==============================================================
  addLine: (position?: Vector3, rotation?: Euler) => {
    // If no position is provided, create a random one
    if (!position) {
      position = new Vector3(Math.random() * 2 - 1, Math.random() * 1.5, Math.random() * 2 - 1);
    }
    // If no rotation is provided, create a random one
    if (!rotation) {
      rotation = new Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    }
    const id = generateUUID();
    const line = {
      id, type: "line" as const, position: position.clone(), rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "x = (0,0,0) + t·(1,0,0)", // Placeholder, updated below
      visible: true,
    };
    set((state) => ({ objects: [...state.objects, line], selectedObjectId: id, }));
    get().updateEquation(id); // Use original separate update call
  },

  addPlane: (position?: Vector3, rotation?: Euler) => {
    // If no position is provided, create a random one
    if (!position) {
      position = new Vector3(Math.random() * 2 - 1, Math.random() * 1.5, Math.random() * 2 - 1);
    }
    // If no rotation is provided, create a random one
    if (!rotation) {
      rotation = new Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    }
    const id = generateUUID();
    const plane = {
      id, type: "plane" as const, position: position.clone(), rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "0x + 0y + 1z = 0", // Placeholder, updated below
      visible: true,
    };
    set((state) => ({ objects: [...state.objects, plane], selectedObjectId: id, }));
    get().updateEquation(id); // Use original separate update call
  },

  removeObject: (id) => {
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    }));
  },

  updateObjectPosition: (id, position) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, position: position.clone() } : obj,
      ),
    }));
    get().updateEquation(id); // Crucially, call the separate updateEquation
  },

  /* // Keep if needed later
  updateObjectRotation: (id, rotation) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, rotation: rotation.clone() } : obj,
      ),
    }));
    get().updateEquation(id);
  },
  */

  updateEquation: (id) => {
    const object = get().objects.find((obj) => obj.id === id);
    if (!object) return;
    let equation = "";
    if (object.type === "line") {
      const direction = new Vector3(1, 0, 0).applyEuler(object.rotation).normalize();
      equation = `P = (${object.position.x.toFixed(1)}, ${object.position.y.toFixed(1)}, ${object.position.z.toFixed(1)}) + t(${direction.x.toFixed(1)}, ${direction.y.toFixed(1)}, ${direction.z.toFixed(1)})`; // Using P= notation
    } else {
      const normal = new Vector3(0, 0, 1).applyEuler(object.rotation).normalize();
      const d = -normal.dot(object.position);
      // Use slightly nicer formatting from previous attempt
      const formatCoeff = (val: number, axis: string) => {
        if (Math.abs(val) < 0.01) return "";
        const sign = val >= 0 ? "+" : "-"; // Include + for leading positive terms
        const num = Math.abs(val).toFixed(2);
        // Handle '1' coefficient nicely
        const numStr = (num === '1.00' && axis) ? '' : num;
        return ` ${sign} ${numStr}${axis} `;
      };
      const formatD = (val: number) => {
        if (Math.abs(val) < 0.01) return " "; // ensure space if d is zero
        const sign = val >= 0 ? "+" : "-";
        const num = Math.abs(val).toFixed(2);
        return ` ${sign} ${num} `;
      }
      let eq = `${formatCoeff(normal.x, 'x')}${formatCoeff(normal.y, 'y')}${formatCoeff(normal.z, 'z')}${formatD(d)}= 0`.trim();
      if (eq.startsWith('+ ')) eq = eq.substring(2); // Remove leading +
      if (eq.startsWith('- ')) eq = "-" + eq.substring(2); // Keep leading -
      equation = eq || "0 = 0"; // Handle all zero case
    }
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, equation } : obj,
      ),
    }));
  },

  selectObject: (id) => {
    set({ selectedObjectId: id });
  },

  /* // Keep if needed later
  toggleVisibility: (id) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj,
      ),
    }));
  },
  */
  // ==============================================================
  // END: Actions copied EXACTLY from the original working code
  // ==============================================================


  // --- Equation Mode Actions (From previous version) ---
  setMode: (mode) => set({ mode }),
  setEquationType: (type) => set({ equationType: type }),
  setLineParam: (param, value) => set((s) => ({ lineParams: { ...s.lineParams, [param]: value } })),
  setPlaneParam: (param, value) => set((s) => ({ planeParams: { ...s.planeParams, [param]: value } })),
  spawnFromEquation: () => {
    const { equationType, lineParams, planeParams, addLine, addPlane } = get();
    if (equationType === 'line') {
      const { position, rotation } = getLineTransform(lineParams);
      addLine(position, rotation); // Calls the original addLine
    } else {
      const { position, rotation } = getPlaneTransform(planeParams);
      addPlane(position, rotation); // Calls the original addPlane
    }
  },

  // Required Action: Clear All (From previous versions)
  clearAll: () => set({ objects: [], selectedObjectId: null }),

}));


/*************************
 * 2.  Scene Helpers & Components
 *************************/

// CoordinateSystem (Unchanged from original)
const CoordinateSystem = () => (
  <group>
    <mesh position={[0, 0, 0]}> <sphereGeometry args={[0.03]} /> <meshStandardMaterial color="#ffffff" /> </mesh>
    <Line points={[[0, 0, 0], [1, 0, 0]]} color="red" lineWidth={2} /> <Text position={[1.1, 0, 0]} fontSize={0.05} color="red">X</Text>
    <Line points={[[0, 0, 0], [0, 1, 0]]} color="green" lineWidth={2} /> <Text position={[0, 1.1, 0]} fontSize={0.05} color="green">Y</Text>
    <Line points={[[0, 0, 0], [0, 0, 1]]} color="blue" lineWidth={2} /> <Text position={[0, 0, 1.1]} fontSize={0.05} color="blue">Z</Text>
    <gridHelper args={[4, 20, "#555", "#333"]} position={[0, -0.01, 0]} />
  </group>
);

// ==============================================================
// START: MathLine copied EXACTLY from the original working code
// ==============================================================
const MathLine = ({ id, position, rotation, color, isSelected }: {
  id: string; position: Vector3; rotation: Euler; color: string; isSelected: boolean;
}) => {
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  const lineRef = useRef<Mesh>(null); // Ref for visible line mesh
  const handleRef = useRef<Mesh>(null); // Ref for invisible handle sphere
  const isDraggingRef = useRef(false);
  const dragStartPointRef = useRef<Vector3 | null>(null); // World space point where drag started
  const objectStartPositionRef = useRef<Vector3 | null>(null); // Object's world position when drag started

  const handleSelect = () => { selectObject(id); };

  // Get equation dynamically for text display
  const equation = useLinePlaneStore(state => state.objects.find(obj => obj.id === id)?.equation);

  // Use pointer events directly on the handle mesh
  return (
    <group position={position} rotation={rotation}>
      {/* Visible Line representation */}
      <mesh ref={lineRef} onClick={handleSelect}>
        <cylinderGeometry args={[0.01, 0.01, 2, 8]} />
        <meshStandardMaterial color={color} opacity={isSelected ? 0.8 : 0.5} transparent />
      </mesh>

      {/* Dedicated handle (sphere) for selection and dragging */}
      <mesh
        ref={handleRef}
        position={[0, 0, 0]} // Position handle at the object's origin
        onClick={handleSelect} // Select on click
        onPointerDown={(e) => {
          // Check if the event is a PointerEvent (needed for pointer capture)
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Only allow dragging if this object is selected
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation();
            isDraggingRef.current = true;
            dragStartPointRef.current = e.point.clone(); // Record world space start point
            objectStartPositionRef.current = position.clone(); // Record object's start position
            // Capture the pointer to ensure events are received even if pointer moves off the handle
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Only move if dragging is active and start points are recorded
          if (isSelected && isDraggingRef.current && dragStartPointRef.current && objectStartPositionRef.current) {
            e.stopPropagation();
            // Calculate the movement delta in world space
            const dragDelta = new Vector3().subVectors(e.point, dragStartPointRef.current,);
            // Apply the delta to the original object position
            const newPosition = objectStartPositionRef.current.clone().add(dragDelta);
            // Update the object position in the store (triggers re-render and equation update)
            updateObjectPosition(id, newPosition);
          }
        }}
        onPointerUp={(e) => {
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Release pointer capture and reset dragging state
          if (isDraggingRef.current) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
          }
        }}
        onPointerLeave={(e) => { // Also stop dragging if pointer leaves the handle while down
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          if (isDraggingRef.current) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            isDraggingRef.current = false;
            dragStartPointRef.current = null;
            objectStartPositionRef.current = null;
          }
        }}
      // Make the handle visually distinct when selected, but keep it small
      >
        <sphereGeometry args={[0.05]} /> {/* Small sphere handle */}
        <meshStandardMaterial
          color={isSelected ? "#ffffff" : color} // White when selected
          opacity={0.8}
          transparent
          visible={isSelected} // Only show handle when selected
        />
      </mesh>

      {/* Display equation */}
      <Text position={[0, 0.1, 0]} fontSize={0.05} color="white" anchorX="center" anchorY="bottom">
        {equation || ""}
      </Text>
    </group>
  );
};
// ==============================================================
// END: MathLine copied EXACTLY from the original working code
// ==============================================================


// ==============================================================
// START: MathPlane copied EXACTLY from the original working code
// ==============================================================
const MathPlane = ({ id, position, rotation, color, isSelected }: {
  id: string; position: Vector3; rotation: Euler; color: string; isSelected: boolean;
}) => {
  const { updateObjectPosition, selectObject } = useLinePlaneStore();
  const meshRef = useRef<Mesh>(null); // Ref for the plane mesh
  const isDraggingRef = useRef(false);

  const handleSelect = () => { selectObject(id); };

  // Get equation dynamically for text display
  const equation = useLinePlaneStore(state => state.objects.find(obj => obj.id === id)?.equation);

  // Use pointer events directly on the plane mesh
  return (
    <group position={position} rotation={rotation}>
      {/* Plane representation */}
      <mesh
        ref={meshRef}
        onClick={handleSelect} // Select on click
        onPointerDown={(e) => {
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Only allow dragging if selected
          if (isSelected && !isDraggingRef.current) {
            e.stopPropagation();
            isDraggingRef.current = true;
            // Capture the pointer
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            // Optional: Update position immediately on down for quicker feedback
            updateObjectPosition(id, e.point);
          }
        }}
        onPointerMove={(e) => {
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Move plane to follow pointer intersection point if dragging
          if (isSelected && isDraggingRef.current) {
            e.stopPropagation();
            updateObjectPosition(id, e.point); // Update position directly
          }
        }}
        onPointerUp={(e) => {
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          // Release pointer and reset dragging state
          if (isDraggingRef.current) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            isDraggingRef.current = false;
          }
        }}
        onPointerLeave={(e) => { // Stop dragging if pointer leaves the plane
          if (!(e.nativeEvent instanceof PointerEvent)) return;
          if (isDraggingRef.current) {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            isDraggingRef.current = false;
          }
        }}
      >
        <planeGeometry args={[1, 1]} /> {/* Geometry */}
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.7 : 0.4}
          transparent
          side={2} // Render both sides
          emissive={isSelected ? color : undefined} // Glow when selected
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Display equation - Adjusted position relative to plane */}
      <Text
        position={[0, 0, 0.05]} // Slightly above plane surface
        rotation={[-Math.PI / 2, 0, 0]} // Orient text horizontally relative to plane's default
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="middle" // Center vertically too
      >
        {equation || ""}
      </Text>
    </group>
  );
};
// ==============================================================
// END: MathPlane copied EXACTLY from the original working code
// ==============================================================


// --- Panel Button Component (From previous version, uses Interactive) ---
const PanelButton = ({ label, position, onSelect, color = "#446", width = 0.3, height = 0.04, fontSize = 0.02 }: {
  label: string; position: [number, number, number]; onSelect: () => void;
  color?: string; width?: number; height?: number; fontSize?: number;
}) => (
  <Interactive onSelect={onSelect}>
    <group position={position}>
      <mesh> <planeGeometry args={[width, height]} /> <meshStandardMaterial color={color} transparent opacity={0.9} side={2} /> </mesh>
      <Text position={[0, 0, 0.001]} fontSize={fontSize} color="white" anchorX="center" anchorY="middle"> {label} </Text>
    </group>
  </Interactive>
);

// --- Value Adjuster Component (+/- buttons, from previous version) ---
const ValueAdjuster = ({ label, value, paramKey, min, max, onChange, yPos }: {
  label: string; value: number; paramKey: keyof LineEqParams | keyof PlaneEqParams;
  min: number; max: number;
  onChange: (key: any, value: number) => void; yPos: number;
}) => {
  const buttonSize = 0.03; const spacing = 0.01; const barWidth = 0.25; const increment = 0.5;
  const handleDecrement = () => { onChange(paramKey, Math.max(min, value - increment)); };
  const handleIncrement = () => { onChange(paramKey, Math.min(max, value + increment)); };
  return (
    <group position={[0, yPos, 0.01]}>
      <Text position={[-barWidth / 2 - spacing, 0, 0]} fontSize={0.018} color="white" anchorX="right" anchorY="middle"> {label}: </Text>
      <Text position={[0, 0, 0]} fontSize={0.02} color="yellow" anchorX="center" anchorY="middle" > {value.toFixed(1)} </Text>
      <Interactive onSelect={handleDecrement}>
        <mesh position={[-buttonSize - spacing * 3, 0, 0]}> <planeGeometry args={[buttonSize, buttonSize]} /> <meshStandardMaterial color="#b55" side={2} /> </mesh>
        <Text position={[-buttonSize - spacing * 3, 0, 0.001]} fontSize={0.02} color="white" anchorX="center" anchorY="middle"> - </Text>
      </Interactive>
      <Interactive onSelect={handleIncrement}>
        <mesh position={[buttonSize + spacing * 3, 0, 0]}> <planeGeometry args={[buttonSize, buttonSize]} /> <meshStandardMaterial color="#5b5" side={2} /> </mesh>
        <Text position={[buttonSize + spacing * 3, 0, 0.001]} fontSize={0.02} color="white" anchorX="center" anchorY="middle"> + </Text>
      </Interactive>
    </group>
  );
};


// --- Control Panel (Fixed Position, Uses PanelButton) ---
const ControlPanel = () => {
  const { selectedObjectId, addLine, addPlane, removeObject, clearAll, setMode } = useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);

  // Add Clear All button functionality
  const handleClearAll = () => {
    // Add confirmation dialog? For now, just clear.
    clearAll();
  };

  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh> <planeGeometry args={[0.4, 0.40]} /> <meshStandardMaterial color="#22224a" transparent opacity={0.8} side={2} /> </mesh>
      <Text position={[0, 0.17, 0.01]} fontSize={0.025} color="white" anchorX="center" anchorY="middle"> Controls </Text>
      {/* Use PanelButton Component */}
      <PanelButton label="Add Random Line" position={[0, 0.11, 0.01]} onSelect={() => addLine()} /> {/* Pass function directly */}
      <PanelButton label="Add Random Plane" position={[0, 0.06, 0.01]} onSelect={() => addPlane()} /> {/* Pass function directly */}
      {selectedObjectId && <PanelButton label="Delete Selected" position={[0, 0.01, 0.01]} onSelect={() => removeObject(selectedObjectId)} color="#a44" />}
      <PanelButton label="Clear All" position={[0, -0.04, 0.01]} onSelect={handleClearAll} color="#6f2ca5" /> {/* Added Clear All */}
      <PanelButton label="Enter Equation Mode" position={[0, -0.12, 0.01]} onSelect={() => setMode('equation')} color="#276" width={0.35} />
    </group>
  );
};


// --- Equation Panel (Fixed Position, uses ValueAdjuster, PanelButton) ---
const EquationPanel = () => {
  const { equationType, lineParams, planeParams, setEquationType, setLineParam, setPlaneParam, spawnFromEquation, setMode } = useLinePlaneStore();
  const panelPosition = useMemo(() => new Vector3(0, 1.5, -1.0), []);
  const panelRotation = useMemo(() => new Euler(0, 0, 0), []);
  const sliderProps = { min: -5, max: 5 };
  const normalSliderProps = { min: -1, max: 1 };

  return (
    <group position={panelPosition} rotation={panelRotation}>
      <mesh> <planeGeometry args={[0.45, 0.60]} /> <meshStandardMaterial color="#2a224a" transparent opacity={0.85} side={2} /> </mesh>
      <Text position={[0, 0.27, 0.01]} fontSize={0.025} color="white" anchorX="center" anchorY="middle"> Define Equation </Text>
      <PanelButton label="Line" position={[-0.1, 0.22, 0.01]} width={0.15} height={0.035} fontSize={0.018} onSelect={() => setEquationType('line')} color={equationType === 'line' ? '#66a' : '#446'} />
      <PanelButton label="Plane" position={[0.1, 0.22, 0.01]} width={0.15} height={0.035} fontSize={0.018} onSelect={() => setEquationType('plane')} color={equationType === 'plane' ? '#66a' : '#446'} />
      {equationType === 'line' ? (<>
        <Text position={[-0.2, 0.17, 0.01]} fontSize={0.018} color="lightblue" anchorX="left">Point (pX, pY, pZ)</Text>
        <ValueAdjuster label="pX" value={lineParams.pX} paramKey="pX" {...sliderProps} onChange={setLineParam} yPos={0.13} />
        <ValueAdjuster label="pY" value={lineParams.pY} paramKey="pY" {...sliderProps} onChange={setLineParam} yPos={0.09} />
        <ValueAdjuster label="pZ" value={lineParams.pZ} paramKey="pZ" {...sliderProps} onChange={setLineParam} yPos={0.05} />
        <Text position={[-0.2, 0.00, 0.01]} fontSize={0.018} color="lightgreen" anchorX="left">Direction (dX, dY, dZ)</Text>
        <ValueAdjuster label="dX" value={lineParams.dX} paramKey="dX" {...normalSliderProps} onChange={setLineParam} yPos={-0.04} />
        <ValueAdjuster label="dY" value={lineParams.dY} paramKey="dY" {...normalSliderProps} onChange={setLineParam} yPos={-0.08} />
        <ValueAdjuster label="dZ" value={lineParams.dZ} paramKey="dZ" {...normalSliderProps} onChange={setLineParam} yPos={-0.12} /> </>
      ) : (<>
        <Text position={[-0.2, 0.17, 0.01]} fontSize={0.018} color="salmon" anchorX="left">Normal (nX, nY, nZ)</Text>
        <ValueAdjuster label="nX" value={planeParams.nX} paramKey="nX" {...normalSliderProps} onChange={setPlaneParam} yPos={0.13} />
        <ValueAdjuster label="nY" value={planeParams.nY} paramKey="nY" {...normalSliderProps} onChange={setPlaneParam} yPos={0.09} />
        <ValueAdjuster label="nZ" value={planeParams.nZ} paramKey="nZ" {...normalSliderProps} onChange={setPlaneParam} yPos={0.05} />
        <Text position={[-0.2, 0.00, 0.01]} fontSize={0.018} color="gold" anchorX="left">Constant (d)</Text>
        <ValueAdjuster label="d" value={planeParams.d} paramKey="d" {...sliderProps} onChange={setPlaneParam} yPos={-0.04} /> </>
      )}
      <PanelButton label="Spawn Object" position={[0, -0.19, 0.01]} onSelect={spawnFromEquation} color="#2a5" width={0.25} />
      <PanelButton label="Back to Controls" position={[0, -0.24, 0.01]} onSelect={() => setMode('random')} color="#777" width={0.25} />
    </group>
  );
};


/*************************
 * 3.  Main Scene (Renders original MathLine/MathPlane, conditional panels)
 *************************/
export const ARScene = () => {
  const { objects, selectedObjectId, mode } = useLinePlaneStore();

  // Initialize with a line and plane using original seeding logic
  useEffect(() => {
    // Check length via getState to avoid adding to dependency array
    if (useLinePlaneStore.getState().objects.length === 0) {
      console.log("Seeding initial objects...");
      useLinePlaneStore.getState().addLine(); // Calls original addLine for random
      useLinePlaneStore.getState().addPlane(); // Calls original addPlane for random
    }
  }, []); // Run only once on mount

  return (
    <> {/* Use Fragment instead of group if no transform needed */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 5, 3]} intensity={0.5} />

      <CoordinateSystem />

      {/* Render Math Objects using the original components */}
      {objects.map((object) =>
        object.visible && (
          // No extra group needed here, position/rotation is handled inside MathLine/MathPlane
          object.type === "line" ? (
            <MathLine
              key={object.id} // Key on the component itself
              id={object.id}
              position={object.position}
              rotation={object.rotation}
              color={object.color}
              isSelected={object.id === selectedObjectId}
            />
          ) : (
            <MathPlane
              key={object.id} // Key on the component itself
              id={object.id}
              position={object.position}
              rotation={object.rotation}
              color={object.color}
              isSelected={object.id === selectedObjectId}
            />
          )
        )
      )}

      {/* Conditionally Render Fixed Panels */}
      {mode === 'random' ? <ControlPanel /> : <EquationPanel />}
    </>
  );
};
