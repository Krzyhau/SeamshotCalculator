// binary parser class that I made to easily deal with reading binary data.
class BinaryParser{
    constructor(buffer){
        if(buffer.constructor === Uint8Array){
            this.buffer = buffer;
            this.offset = 0;
        }else{
            console.error("BinaryParser constructor error: can't process given parameter.");
        }
    }
    
    read(type,size,newOffset){
        if(newOffset>0)this.offset=newOffset;
        if(this.hasEnded())return null;
        let bytes = this.getRange(size);
        let output = null;
        switch(type){
            case "string":
                output = this.parseString(bytes);
                break;
            case "int": case "uint":
                output = this.parseInt(bytes, (type!="uint"));
                break;
            case "float":
                output = this.parseFloat(bytes);
                break;
            case "raw":
                output = bytes;
        }
        this.offset += size;
        return output;
    }
    
    parseString(bytes){
        let output = "";
        for(let i = 0; i<bytes.length; i++){
            output += String.fromCharCode(this.buffer[this.offset+i]);
        }
        return output;
    }
    
    parseInt(bytes,signed){
        let output = 0;
        let size = bytes.length;
        for(let i=0; i<size;i++){
            let a = bytes[i];
            if(signed && i==size-1 && a>>>7==1){
                output -= Math.pow(2,size*8);
            }
            output += a* (1<<(i*8));
        }
        return output;
    }
    
    //works properly only for 4-bytes floats.
    parseFloat(bytes){
        let output = this.parseInt(bytes,true);
        let s = (output & 0x80000000) ? -1 : 1;
        let e = ((output >> 23) & 0xFF) - 127;
        let x = (output & ~(-1 << 23));
        if (e == 128) output = s * ((x) ? Number.NaN : Number.POSITIVE_INFINITY);
        if (e == -127) {
            if (x == 0) output = s * 0.0;
            e = -126;
            x /= (1 << 22);
        } else x = (x | (1 << 23)) / (1 << 23);
        output = s * x * Math.pow(2, e);
        return output;
    }
    
    getRange(size,start=this.offset){
        let bytes = [];
        let bitOffset = (this.offset % 1)*8;
        let byteOffset = this.offset - bitOffset/8;
        for(let i=0; i<size;i++){
            let byte = this.buffer[byteOffset+i];
            if(bitOffset>0){
                byte = ((byte<<bitOffset)|(this.buffer[byteOffset+i+1]>>>(8-bitOffset)))&255;
            }
            if(size-i<1)byte = byte & ((1<<(8-(size-i)*8)));
            bytes[i]=byte;
        }
        return bytes;
    }
    
    hasEnded(){
        return this.offset>this.buffer.length;
    }
    
}