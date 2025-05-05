Here are example matrices you can input into the RREF editor panel to test the different features, focusing on keeping the initial planes generally in the positive octant for easier viewing in AR.

---

**Test Case 1: Unique Solution (Simple)**

*   **Goal:** Three orthogonal planes intersecting at `(1, 2, 3)`.
*   **Matrix to Edit:**
    ```
    [ 1, 0, 0, 1 ]  // x = 1
    [ 0, 1, 0, 2 ]  // y = 2
    [ 0, 0, 1, 3 ]  // z = 3
    ```
*   **Expected Outcome:**
    *   The matrix is already in RREF.
    *   Analysis: Consistent, Unique Solution: (1.00, 2.00, 3.00)
    *   Visualization: Three planes (parallel to YZ, XZ, XY planes respectively) intersecting visually at the point (1, 2, 3). A yellow sphere ("Solution") should appear at this point. Pairwise intersection lines will also be visible where the planes meet.

---

**Test Case 2: Unique Solution (More General)**

*   **Goal:** Three non-orthogonal planes intersecting at `(1, 1, 1)`.
*   **Matrix to Edit:**
    ```
    [ 1,  1,  1,  3 ]  // x + y + z = 3
    [ 1, -1,  1,  1 ]  // x - y + z = 1
    [ 2,  1, -1,  2 ]  // 2x + y - z = 2
    ```
*   **Expected Outcome:**
    *   The RREF algorithm will perform several steps (swaps, scales, eliminations).
    *   Final RREF: `[[1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]]`
    *   Analysis: Consistent, Unique Solution: (1.00, 1.00, 1.00)
    *   Visualization: Three tilted planes will change orientation/position with each step. The intersection lines between pairs will move, but the final unique intersection point `(1, 1, 1)` (marked by the yellow "Solution" sphere) should remain constant throughout the process.

---

**Test Case 3: Infinite Solutions (Line)**

*   **Goal:** The third plane is a linear combination of the first two (dependent system).
*   **Matrix to Edit:**
    ```
    [ 1, 1, 1, 3 ]  // x + y + z = 3
    [ 1,-1, 1, 1 ]  // x - y + z = 1
    [ 2, 0, 2, 4 ]  // 2x + 2z = 4 (Row3 = Row1 + Row2)
    ```
*   **Expected Outcome:**
    *   RREF algorithm will result in a row of zeros.
    *   Final RREF (approx): `[[1, 0, 1, 2], [0, 1, 0, 1], [0, 0, 0, 0]]`
    *   Analysis: Consistent, Infinite Solutions (Line)
    *   Visualization: The planes will shift. The pairwise intersection lines will change, but *all three planes* should always intersect along the *same common line* throughout the steps. This common intersection line will be visualized as a magenta line. No unique solution point will be shown.

---

**Test Case 4: Infinite Solutions (Plane)**

*   **Goal:** Coincident planes (dependent system).
*   **Matrix to Edit:**
    ```
    [ 1, 1, 1, 2 ]  // x + y + z = 2
    [ 2, 2, 2, 4 ]  // 2x + 2y + 2z = 4 (Row2 = 2 * Row1)
    [-1,-1,-1,-2 ]  // -x - y - z = -2 (Row3 = -1 * Row1)
    ```
*   **Expected Outcome:**
    *   RREF algorithm will result in two rows of zeros.
    *   Final RREF (approx): `[[1, 1, 1, 2], [0, 0, 0, 0], [0, 0, 0, 0]]`
    *   Analysis: Consistent, Infinite Solutions (Plane)
    *   Visualization: The three initial planes should appear coincident (overlapping). As steps proceed, they might visually separate slightly due to calculations but should reduce back to representing the single solution plane `x+y+z=2`. No distinct intersection lines or points should be visible between the *solution* planes (as they are the same), although the visualization might show the magenta line if the intermediate planes *temporarily* intersect differently.

---

**Test Case 5: Inconsistent System**

*   **Goal:** Parallel planes or no common intersection.
*   **Matrix to Edit:**
    ```
    [ 1, 1, 1, 2 ]  // x + y + z = 2
    [ 1, 1, 1, 4 ]  // x + y + z = 4 (Parallel to Row 1)
    [ 1,-1, 0, 1 ]  // x - y = 1
    ```
*   **Expected Outcome:**
    *   RREF algorithm will result in a row `[0 0 0 | k]` where k is non-zero.
    *   Example intermediate/final step might look like: `[[1, 1, 1, 2], [0, -2, -1, -1], [0, 0, 0, 2]]` (or similar after further reduction)
    *   Analysis: Inconsistent system (no solution).
    *   Visualization: The planes will move. You will likely see pairwise intersection lines, but there will be *no single point or line* where all three planes meet simultaneously. No yellow solution sphere will appear.

These examples cover the main scenarios and should help verify that the RREF calculation, the dynamic plane updates, the intersection calculations, and the solution analysis are all working correctly together.