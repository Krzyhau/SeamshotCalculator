importScripts(
    "vector.js",
    "binary-parser.js",
    "bsp-parser.js"
);

// very dumb logging system idk dont @ me
const Log = {
    set status(status) {
        Log._status = status;
        Log._perc = 0;
        Log.update();
    },
    set percentage(perc) {
        let oldPerc = Log._perc;
        Log._perc = Math.floor(perc + 0.5);
        if(oldPerc != Log._perc)Log.update();
    },
    update: function () {
        let msg = Log._status;
        if (Log._perc > 0) msg += "(" + Log._perc + "%)";
        postMessage(msg);
    }
}

onmessage = function (e) {
    Log.status = "Parsing BSP file...";
    let map = BSP.parseMap(e.data);

    console.log(map);
    let seamshots = findSeamshots(map);

    postMessage(seamshots);
}


// very cool and shitty function for finding seamshots
function findSeamshots(map) {
    const PLANE_DIST_ERROR = 0.001;
    const DOT_ERROR = 0.0001;

    let edges = [];
    
    Log.status = "Finding brush edges...";
    //find all edges of every brush
    for (let b = 0; b < map.brushes.length; b++) {
        let brush = map.brushes[b];
        Log.percentage = (b / map.brushes.length) * 100;
        // ignoring the brush if it's not solid (CONTENTS_SOLID)
        if ((brush.contents & 0x1) == 0) continue;
        if (brush.leafs.length == 0) continue;
        
        for (let i = 0; i < brush.numsides-1; i++) {
            let brushSide1 = map.brushSides[brush.firstside + i];
            if (brushSide1.bevel) continue;
            let plane1 = map.planes[brushSide1.planenum];

            for (let j = i + 1; j < brush.numsides; j++) {
                let brushSide2 = map.brushSides[brush.firstside + j];
                if (i == j || brushSide2.bevel) continue;
                
                let plane2 = map.planes[brushSide2.planenum];

                // finding an intersection between two planes
                let n1 = plane1.normal;
                let n2 = plane2.normal;
                let d1 = plane1.dist;
                let d2 = plane2.dist;

                if (n1.sub(n2).length() < DOT_ERROR || n1.mult(-1).sub(n2).length() < DOT_ERROR) continue;

                // intersection line direction is just cross product
                let lineDir = n1.cross(n2).normalized();

                // for point calculations, assuming either x=0, y=0 or z=0, depending on whether
                // line ever crosses the YZ, XZ or XY plane respectively
                let linePoint = new Vector();
                if (lineDir.x != 0) {
                    linePoint.x = 0;
                    linePoint.z = (n1.y*d2 - n2.y*d1) / (n1.y*n2.z - n1.z*n2.y);
                    linePoint.y = (n1.y != 0) ? ((d1 - n1.z * linePoint.z) / n1.y) : ((d2 - n2.z * linePoint.z) / n2.y);
                } else if(lineDir.y != 0){
                    linePoint.y = 0;
                    linePoint.z = (n1.x*d2 - n2.x*d1) / (n1.x*n2.z - n1.z*n2.x);
                    linePoint.x = (n1.x != 0) ? ((d1 - n1.z * linePoint.z) / n1.x) : ((d2 - n2.z * linePoint.z) / n2.x);
                } else {
                    linePoint.z = 0;
                    linePoint.y = (n1.x*d2 - n2.x*d1) / (n1.x*n2.y - n1.y*n2.x);
                    linePoint.x = (n1.x != 0) ? ((d1 - n1.y * linePoint.y) / n1.x) : ((d2 - n2.y * linePoint.y) / n2.x);
                }

                // "ya mate im gonna give you some nans for no reason good luck debugging it"
                if (isNaN(linePoint.x) || isNaN(linePoint.y) || isNaN(linePoint.z)) {
                    console.error(
                        "Cannot find an intersection point of two planes: "
                        + "n1=" + n1 + ", n2=" + n2 + ", d1=" + d1 + ", d2=" + d1
                        + ", lineDir=" + lineDir + ", linePoint=" + linePoint
                    );
                }

                // finding edge points
                let minDist = Number.NEGATIVE_INFINITY;
                let maxDist = Number.POSITIVE_INFINITY;

                for (let k = 0; k < brush.numsides; k++) {
                    let brushSide3 = map.brushSides[brush.firstside + k];
                    if (i == k || j == k || brushSide3.bevel) continue;

                    let plane3 = map.planes[brushSide3.planenum];

                    let n3 = plane3.normal;
                    let d3 = plane3.dist;

                    if (n3.dot(lineDir) == 0) {
                        if (n3.dot(linePoint) - d3 > PLANE_DIST_ERROR) {
                            minDist = maxDist = Number.NEGATIVE_INFINITY;
                            break;
                        }
                        continue;
                    }
                    
                    let t = (d3 - n3.dot(linePoint)) / n3.dot(lineDir);
                    if (n3.dot(lineDir) > 0 && t < maxDist) {
                        maxDist = t;
                    }
                    if (n3.dot(lineDir) < 0 && t > minDist) {
                        minDist = t;
                    }
                }

                // some edges created by two planes aren't a part of a brush.
                if (maxDist > minDist) {
                    let p1 = linePoint.add(lineDir.mult(minDist));
                    let p2 = linePoint.add(lineDir.mult(maxDist));

                    edges.push({
                        point1: p1,
                        point2: p2,
                        brush: brush
                    });
                }
            }
        }
    }

    console.log(edges);

    
    let seamshots = [];
    // find potential seamshot candidates along all edges
    Log.status = "Finding seamshots...";
    for (let e = 0; e < edges.length;e++) {
        let edge = edges[e];
        Log.percentage = (e / edges.length) * 100;
        // finding edges that lie on brushfaces of other brushes
        for (let brush of map.brushes) {
            if (brush == edge.brush) continue;
            if ((brush.contents & 0x1) == 0) continue;
            if (brush.leafs.length == 0) continue;

            let neverColliding = false;

            let seamshot = {
                point1: edge.point1,
                point2: edge.point2,
                brush1: edge.brush,
                brush2: brush,
                type: 0,
                planenum: 0
            };

            for (let i = 0; i < brush.numsides; i++) {
                let brushSide = map.brushSides[brush.firstside + i];
                if (brushSide.bevel) continue;
                let plane = map.planes[brushSide.planenum];
                let n = plane.normal;
                let d = plane.dist;

                let p1 = seamshot.point1;
                let pd1 = n.dot(p1) - d;

                let p2 = seamshot.point2;
                let pd2 = n.dot(p2) - d;

                //detecting if points are away from the brush
                if (pd1 >= PLANE_DIST_ERROR && pd2 >= PLANE_DIST_ERROR) {
                    neverColliding = true;
                    break;
                }

                if (Math.abs(pd1) < PLANE_DIST_ERROR && Math.abs(pd2) < PLANE_DIST_ERROR) {
                    seamshot.planenum++;
                }

                // adjusting points to be limited by brush planes
                if (pd1 >= PLANE_DIST_ERROR && pd2 < PLANE_DIST_ERROR) {
                    seamshot.point1 = p2.add((p1.sub(p2)).mult(pd2 / (pd2 - pd1)));
                }
                if (pd2 >= PLANE_DIST_ERROR && pd1 < PLANE_DIST_ERROR) {
                    seamshot.point2 = p1.add((p2.sub(p1)).mult(pd1 / (pd1 - pd2)));
                }
            }

            // the edge line has to "collide" with a brush and lie on one of the planes
            if (seamshot.planenum>0 && !neverColliding) {
                if (edge.brush.isBox != brush.isBox) {
                    // complex-simple seams, almost always possible to shoot through
                    seamshot.type = 1;
                }
                if (!edge.brush.isBox && !brush.isBox) {
                    // complex-complex seams, require BSP tree inspection
                    seamshot.type = 2;
                }
            }

            // BSP tree inspection - checking if brush is in a leaf and if
            // both brushes forming a seam are in the same leaf (then it's not a seamshot)

            if (seamshot.type == 2) {
                let bothBrushesInSameLeaf = false;
                for (let leaf1 of seamshot.brush1.leafs) {
                    for (let leaf2 of seamshot.brush2.leafs) {
                        if (leaf1 == leaf2) {
                            bothBrushesInSameLeaf = true;
                            break;
                        }
                    }
                }
                if (bothBrushesInSameLeaf) continue;
            }
            if (seamshot.type > 0) {
                // avoiding putting a duplicate into the array
                let duplicate = false;
                for (let i = 0; i < seamshots.length; i++) {
                    let s2 = seamshots[i];
                    //only checking seams sharing relevant brushes
                    if (s2.brush1 != edge.brush && s2.brush1 != brush && s2.brush2 != edge.brush && s2.brush2 != brush) continue;
                    if (
                        (seamshot.point1.sub(s2.point1).length() < 0.01 && seamshot.point2.sub(s2.point2).length() < 0.01)
                        || (seamshot.point1.sub(s2.point2).length() < 0.01 && seamshot.point2.sub(s2.point1).length() < 0.01)
                    ) {
                        duplicate = true;
                        break;
                    }
                }

                if(!duplicate) seamshots.push(seamshot);
            }
        }
    }
    Log.status = "Done!";

    return seamshots;
}