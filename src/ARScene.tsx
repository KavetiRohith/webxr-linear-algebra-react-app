import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Line } from "@react-three/drei";
import { Interactive } from "@react-three/xr";
import { Vector3, Group, Euler, Mesh } from "three";
import { create } from "zustand";
import { generateUUID } from "three/src/math/MathUtils.js";

// Define MathObject type for our state management
type MathObject = {
  id: string;
  type: "line" | "plane";
  position: Vector3;
  rotation: Euler;
  color: string;
  equation: string;
  visible: boolean;
};

// Create a store for managing mathematical objects
type LinePlaneStoreState = {
  objects: MathObject[];
  selectedObjectId: string | null;
  addLine: (position?: Vector3, rotation?: Euler) => void;
  addPlane: (position?: Vector3, rotation?: Euler) => void;
  removeObject: (id: string) => void;
  updateObjectPosition: (id: string, position: Vector3) => void;
  updateObjectRotation: (id: string, rotation: Euler) => void;
  updateEquation: (id: string) => void;
  selectObject: (id: string | null) => void;
  toggleVisibility: (id: string) => void;
};

export const useLinePlaneStore = create<LinePlaneStoreState>((set, get) => ({
  objects: [],
  selectedObjectId: null,

  addLine: (position?: Vector3, rotation?: Euler) => {
    // If no position is provided, create a random one
    if (!position) {
      position = new Vector3(
        Math.random() * 2 - 1, // x between -1 and 1
        Math.random() * 1.5, // y between 0 and 1.5
        Math.random() * 2 - 1, // z between -1 and 1
      );
    }

    // If no rotation is provided, create a random one
    if (!rotation) {
      rotation = new Euler(
        Math.random() * Math.PI * 2, // random rotation around x
        Math.random() * Math.PI * 2, // random rotation around y
        Math.random() * Math.PI * 2, // random rotation around z
      );
    }

    const id = generateUUID();
    const line = {
      id,
      type: "line" as const,
      position: position.clone(),
      rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "x = (0,0,0) + t·(1,0,0)",
      visible: true,
    };

    set((state) => ({
      objects: [...state.objects, line],
      selectedObjectId: id,
    }));

    get().updateEquation(id);
  },

  addPlane: (position?: Vector3, rotation?: Euler) => {
    // If no position is provided, create a random one
    if (!position) {
      position = new Vector3(
        Math.random() * 2 - 1, // x between -1 and 1
        Math.random() * 1.5, // y between 0 and 1.5
        Math.random() * 2 - 1, // z between -1 and 1
      );
    }

    // If no rotation is provided, create a random one
    if (!rotation) {
      rotation = new Euler(
        Math.random() * Math.PI * 2, // random rotation around x
        Math.random() * Math.PI * 2, // random rotation around y
        Math.random() * Math.PI * 2, // random rotation around z
      );
    }

    const id = generateUUID();
    const plane = {
      id,
      type: "plane" as const,
      position: position.clone(),
      rotation: rotation.clone(),
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
      equation: "0x + 0y + 1z = 0",
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
        obj.id === id ? { ...obj, position: position.clone() } : obj,
      ),
    }));
    get().updateEquation(id);
  },

  updateObjectRotation: (id, rotation) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, rotation: rotation.clone() } : obj,
      ),
    }));
    get().updateEquation(id);
  },

  updateEquation: (id) => {
    const object = get().objects.find((obj) => obj.id === id);
    if (!object) return;

    // Calculate equation based on position and rotation
    let equation = "";

    if (object.type === "line") {
      // Line equation: Point-direction form
      // x = origin + t * direction
      const direction = new Vector3(1, 0, 0)
        .applyEuler(object.rotation)
        .normalize();
      equation = `x = (${object.position.x.toFixed(1)}, ${object.position.y.toFixed(1)}, ${object.position.z.toFixed(1)}) + t·(${direction.x.toFixed(1)}, ${direction.y.toFixed(1)}, ${direction.z.toFixed(1)})`;
    } else {
      // Plane equation: ax + by + cz + d = 0
      // Normal vector is the z-axis transformed by rotation
      const normal = new Vector3(0, 0, 1)
        .applyEuler(object.rotation)
        .normalize();
      const d = -normal.dot(object.position);

      equation = `${normal.x.toFixed(2)}x + ${normal.y.toFixed(2)}y + ${normal.z.toFixed(2)}z + ${d.toFixed(2)} = 0`;
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

  toggleVisibility: (id) => {
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, visible: !obj.visible } : obj,
      ),
    }));
  },
}));

// Component for displaying the coordinate system
const CoordinateSystem = () => {
  return (
    <group>
      {/* Origin point */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.03]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* X-axis (red) */}
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

      {/* Y-axis (green) */}
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

      {/* Z-axis (blue) */}
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

      {/* Grid (optional) */}
      <gridHelper args={[2, 20, "#444444", "#222222"]} />
    </group>
  );
};

// Component for an interactive 3D line
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

  return (
    <group position={position} rotation={rotation}>
      {/* Line representation */}
      <mesh ref={lineRef} onClick={handleSelect}>
        <cylinderGeometry args={[0.01, 0.01, 2, 8]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.8 : 0.5}
          transparent
        />
      </mesh>

      {/* Dedicated handle for selection and dragging */}
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

            // Calculate the movement delta in world space
            const dragDelta = new Vector3().subVectors(
              e.point,
              dragStartPointRef.current,
            );

            // Apply the delta to the original position
            const newPosition = objectStartPositionRef.current
              .clone()
              .add(dragDelta);

            // Update the object position
            updateObjectPosition(id, newPosition);
          }
        }}
        onPointerUp={() => {
          isDraggingRef.current = false;
          dragStartPointRef.current = null;
          objectStartPositionRef.current = null;
        }}
        onPointerLeave={() => {
          isDraggingRef.current = false;
          dragStartPointRef.current = null;
          objectStartPositionRef.current = null;
        }}
      >
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial
          color={isSelected ? "#ffffff" : color}
          opacity={0.8}
          transparent
        />
      </mesh>

      {/* Display equation */}
      <Text
        position={[0, 0.1, 0]}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="bottom"
        backgroundColor={isSelected ? "#00000080" : undefined}
        padding={0.01}
      >
        {useLinePlaneStore.getState().objects.find((obj) => obj.id === id)
          ?.equation || ""}
      </Text>
    </group>
  );
};

// Component for an interactive 3D plane
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

  return (
    <group position={position} rotation={rotation}>
      {/* Plane representation */}
      <mesh
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
        onPointerUp={() => {
          isDraggingRef.current = false;
        }}
        onPointerLeave={() => {
          isDraggingRef.current = false;
        }}
        onClick={handleSelect}
        ref={meshRef}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          opacity={isSelected ? 0.7 : 0.4}
          transparent
          side={2} // DoubleSide
        />
      </mesh>

      {/* Display equation */}
      <Text
        position={[0, 0.1, 0]}
        fontSize={0.05}
        color="white"
        anchorX="center"
        anchorY="bottom"
        backgroundColor={isSelected ? "#00000080" : undefined}
        padding={0.01}
      >
        {useLinePlaneStore.getState().objects.find((obj) => obj.id === id)
          ?.equation || ""}
      </Text>
    </group>
  );
};

// Control panel for creating and managing objects
const ControlPanel = () => {
  const { selectedObjectId, addLine, addPlane, removeObject } =
    useLinePlaneStore();
  const groupRef = useRef<Group>(null);

  // Position the control panel relative to the user
  useFrame(({ camera }) => {
    if (groupRef.current) {
      // Position panel in front of the user, following their view
      const cameraPosition = new Vector3().setFromMatrixPosition(
        camera.matrixWorld,
      );
      const cameraDirection = new Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion,
      );

      const panelPosition = cameraPosition
        .clone()
        .add(cameraDirection.multiplyScalar(0.5));
      panelPosition.y -= 0.2; // Position slightly below eye level

      groupRef.current.position.copy(panelPosition);
      groupRef.current.lookAt(cameraPosition);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[0.4, 0.3]} />
        <meshStandardMaterial color="#222244" opacity={0.7} transparent />
      </mesh>

      <Text position={[0, 0.12, 0.01]} fontSize={0.025} color="white">
        Linear Algebra Tools
      </Text>

      {/* Add Line button */}
      <Interactive onSelect={() => addLine()}>
        <group position={[0, 0.06, 0.01]}>
          <mesh>
            <planeGeometry args={[0.3, 0.04]} />
            <meshStandardMaterial color="#4444aa" />
          </mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.02} color="white">
            Add Line
          </Text>
        </group>
      </Interactive>

      {/* Add Plane button */}
      <Interactive onSelect={() => addPlane()}>
        <group position={[0, 0, 0.01]}>
          <mesh>
            <planeGeometry args={[0.3, 0.04]} />
            <meshStandardMaterial color="#4444aa" />
          </mesh>
          <Text position={[0, 0, 0.01]} fontSize={0.02} color="white">
            Add Plane
          </Text>
        </group>
      </Interactive>

      {/* Delete button (only if an object is selected) */}
      {selectedObjectId && (
        <Interactive onSelect={() => removeObject(selectedObjectId)}>
          <group position={[0, -0.06, 0.01]}>
            <mesh>
              <planeGeometry args={[0.3, 0.04]} />
              <meshStandardMaterial color="#aa4444" />
            </mesh>
            <Text position={[0, 0, 0.01]} fontSize={0.02} color="white">
              Delete Selected
            </Text>
          </group>
        </Interactive>
      )}
    </group>
  );
};

// Main AR Scene component
export const ARScene = () => {
  const { objects, selectedObjectId } = useLinePlaneStore();
  const sceneRef = useRef<Group>(null);

  // Initialize with a line and plane as examples
  useEffect(() => {
    if (objects.length === 0) {
      // Add a sample line with random position/rotation
      useLinePlaneStore.getState().addLine();

      // Add a sample plane with random position/rotation
      useLinePlaneStore.getState().addPlane();
    }
  }, [objects.length]);

  return (
    <group ref={sceneRef}>
      {/* Coordinate system with origin and axes */}
      <CoordinateSystem />

      {/* Render all math objects */}
      {objects.map(
        (object) =>
          object.visible && (
            <group key={object.id}>
              {object.type === "line" ? (
                <MathLine
                  id={object.id}
                  position={object.position}
                  rotation={object.rotation}
                  color={object.color}
                  isSelected={object.id === selectedObjectId}
                />
              ) : (
                <MathPlane
                  id={object.id}
                  position={object.position}
                  rotation={object.rotation}
                  color={object.color}
                  isSelected={object.id === selectedObjectId}
                />
              )}
            </group>
          ),
      )}

      {/* Control panel for creating and managing objects */}
      <ControlPanel />
    </group>
  );
};
