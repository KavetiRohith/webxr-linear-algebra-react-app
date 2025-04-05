import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { XR, createXRStore } from "@react-three/xr";
import { ARScene } from "./ARScene";

const App = () => {
  // Create a store for XR state
  const xrStore = createXRStore();

  return (
    <>
      <Canvas
        style={{
          position: "fixed",
          width: "100vw",
          height: "100vh",
        }}
      >
        <color args={[0, 0, 0]} attach={"background"} />
        <PerspectiveCamera makeDefault position={[0, 1.6, 2]} fov={75} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />

        {/* XR controllers and hands */}
        <XR store={xrStore}>
          {/* Main AR Scene with grid, origin, lines, and planes */}
          <ARScene />
        </XR>
      </Canvas>

      {/* UI for non-AR mode and enter button */}
      <div
        style={{
          position: "fixed",
          display: "flex",
          width: "100vw",
          height: "100vh",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          color: "white",
        }}
      >
        <div>
          <div style={{ paddingTop: "10px" }}>Linear Algebra AR Visualizer</div>
        </div>
        <button
          onClick={() => xrStore.enterAR()}
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "20px",
          }}
        >
          Enter AR
        </button>
      </div>
    </>
  );
};

export default App;
