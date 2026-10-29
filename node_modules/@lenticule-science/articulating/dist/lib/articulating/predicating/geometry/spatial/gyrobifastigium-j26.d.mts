/** A concrete Euclidean presentation of the J26 incidence law proved in Lean. */
export type J26VertexName = "q0" | "q1" | "q2" | "q3" | "a" | "b" | "c" | "d";
export type J26Face = Readonly<{
    name: string;
    vertices: readonly J26VertexName[];
}>;
export declare const gyrobifastigiumJ26: Readonly<{
    type: "GyrobifastigiumJ26";
    vertices: Readonly<{
        q0: readonly number[];
        q1: readonly number[];
        q2: readonly number[];
        q3: readonly number[];
        a: readonly number[];
        b: readonly number[];
        c: readonly number[];
        d: readonly number[];
    }>;
    faces: readonly (Readonly<{
        name: "leftTop";
        vertices: readonly ["q0", "q1", "a"];
    }> | Readonly<{
        name: "leftBottom";
        vertices: readonly ["q3", "q2", "b"];
    }> | Readonly<{
        name: "leftSide0";
        vertices: readonly ["q1", "a", "b", "q2"];
    }> | Readonly<{
        name: "leftSide1";
        vertices: readonly ["a", "q0", "q3", "b"];
    }> | Readonly<{
        name: "rightTop";
        vertices: readonly ["q1", "q2", "c"];
    }> | Readonly<{
        name: "rightBottom";
        vertices: readonly ["q0", "q3", "d"];
    }> | Readonly<{
        name: "rightSide0";
        vertices: readonly ["q2", "c", "d", "q3"];
    }> | Readonly<{
        name: "rightSide1";
        vertices: readonly ["c", "q1", "q0", "d"];
    }>)[];
}>;
//# sourceMappingURL=gyrobifastigium-j26.d.mts.map