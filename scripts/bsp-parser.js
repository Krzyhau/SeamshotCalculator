// BSP map parsing, adjusted to Portal 2
// based on https://developer.valvesoftware.com/wiki/Source_BSP_File_Format

const BSP = {};

BSP.LumpHeader = class{
    constructor(data){
        this.fileOffset = data.read("int", 4);
        this.fileLength = data.read("int", 4);
        this.version = data.read("int", 4);
        this.fourCC = data.read("raw", 4);
    }
}

BSP.Lumps = {
    PLANES: 1,
    NODES: 5,
    LEAFS: 10,
    LEAFBRUSHES: 17,
    BRUSHES: 18,
    BRUSHSIDES: 19,
}

BSP.Plane = class {
    constructor(data) {
        this.normal = new Vector(
            data.read("float", 4),
            data.read("float", 4),
            data.read("float", 4)
        );
        this.dist = data.read("float", 4);
        this.type = data.read("int", 4);
    }
}

BSP.Node = class {
    constructor(data) {
        this.planenum = data.read("int", 4);
        this.children = [
            data.read("int", 4),
            data.read("int", 4)
        ];
        this.mins = new Vector(
            data.read("int", 2),
            data.read("int", 2),
            data.read("int", 2)
        );
        this.maxs = new Vector(
            data.read("int", 2),
            data.read("int", 2),
            data.read("int", 2)
        );
        this.firstface = data.read("uint", 2);
        this.numfaces = data.read("uint", 2);
        this.area = data.read("int", 2);
        this.padding = data.read("int", 2);
    }
}

BSP.Leaf = class {
    constructor(data) {
        this.contents = data.read("int", 4);
        this.cluster = data.read("int", 2);
        this.areaAndFlags = data.read("raw", 2); //fuck that, i aint doing bit separation
        this.mins = [data.read("int", 2), data.read("int", 2), data.read("int", 2)];
        this.maxs = [data.read("int", 2), data.read("int", 2), data.read("int", 2)];
        this.firstleafface = data.read("uint", 2);
        this.numleaffaces = data.read("uint", 2);
        this.firstleafbrush = data.read("uint", 2);
        this.numleafbrushes = data.read("uint", 2);
        this.leafWaterDataID = data.read("int", 2);
        data.read("raw", 2); // padding
    }
}

BSP.LeafBrushRef = class {
    constructor(data) {
        this.id = data.read("uint", 2);
    }
}

BSP.Brush = class {
    constructor(data) {
        this.firstside = data.read("int", 4);
        this.numsides = data.read("int", 4);
        this.contents = data.read("int", 4);
    }
}

BSP.BrushSide = class {
    constructor(data) {
        this.planenum = data.read("uint", 2);
        this.texinfo = data.read("int", 2);
        this.dispinfo = data.read("int", 2);
        this.bevel = data.read("int", 1) > 0;
        this.thin = data.read("int", 1) > 0;
    }
}


BSP.LumpClasses = {
    1: BSP.Plane,
    5: BSP.Node,
    10: BSP.Leaf,
    17: BSP.LeafBrushRef,
    18: BSP.Brush,
    19: BSP.BrushSide
}


BSP.Map = class{
    constructor(data) {
        const HEADER_LUMPS = 64;

        let beginTime = new Date().getTime();
        
        // Parsing header
        this.identifier = data.read("string", 4);
        this.version = data.read("int", 4);
        this.lumps = [];

        for (let i = 0; i < HEADER_LUMPS; i++){
            this.lumps[i] = new BSP.LumpHeader(data);
        }
        this.mapRevision = data.read("int", 4);

        // Parsing only a couple of lumps that we need
        this.planes = this.readLump(data, BSP.Lumps.PLANES);
        this.nodes = this.readLump(data, BSP.Lumps.NODES)
        this.leafs = this.readLump(data, BSP.Lumps.LEAFS);
        this.leafBrushes = this.readLump(data, BSP.Lumps.LEAFBRUSHES);
        this.brushes = this.readLump(data, BSP.Lumps.BRUSHES);
        this.brushSides = this.readLump(data, BSP.Lumps.BRUSHSIDES);


        let endTime = new Date().getTime();
        console.log("parsing done in " + (endTime - beginTime) / 1000 + "s");
        
        this.updateLeafs();
        this.updateBrushes();
    }

    readLump(data, id) {
        let startOffset = this.lumps[id].fileOffset;
        let length = this.lumps[id].fileLength;
        data.offset = startOffset;

        let LumpObject = BSP.LumpClasses[id];
        let lumpObjects = [];

        while (data.offset < startOffset + length) {
            lumpObjects.push(new LumpObject(data));
        }

        return lumpObjects;
    }

    // some leafs shouldn't be used, because they're not linked 
    // to main node in a tree. make sure to deal with that.
    updateLeafs() {
        let nodesToCheck = [0];

        for (let leaf of this.leafs) {
            leaf.existsInTree = false;
        }

        while (nodesToCheck.length > 0) {
            let nodes = nodesToCheck;
            nodesToCheck = [];
            for (let nodeID of nodes) {
                let node = this.nodes[nodeID];
                for (let i = 0; i < 2; i++){
                    let childID = node.children[i];
                    if (childID < 0) {
                        this.leafs[-(childID + 1)].existsInTree = true;
                    } else {
                        nodesToCheck.push(childID);
                    }
                }
            }
        }
    }

    //updating some info about brushes
    updateBrushes() {
        for (let brush of this.brushes) {
            // ignoring the brush if it's not solid (CONTENTS_SOLID)
            if ((brush.contents & 0x1) == 0) continue;

            brush.isBox = true;
            // figure out if the brush is complex
            for (let i = 0; i < brush.numsides; i++) {
                let brushSide = this.brushSides[brush.firstside + i];
                if (brushSide.bevel) continue;
                let normal = this.planes[brushSide.planenum].normal;
                
                if (Math.abs(normal.x) < 1 && Math.abs(normal.y) < 1 && Math.abs(normal.z) < 1) {
                    brush.isBox = false;
                    break;
                }
            }

            brush.leafs = [];
            //figure out in which leafs brush is located in
            for (let i = 0; i < this.leafs.length; i++) {
                let leaf = this.leafs[i];
                if (!leaf.existsInTree) continue;
                for (let j = 0; j < leaf.numleafbrushes; j++) {
                    let leafbrush = this.brushes[this.leafBrushes[leaf.firstleafbrush + j].id];
                    if (brush == leafbrush) {
                        brush.leafs.push(i);
                    }
                }
            }
        }
    }
}

BSP.parseMap = function (data) {
    let array = new Uint8Array(data);
    return new BSP.Map(new BinaryParser(array));
}