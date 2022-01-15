// a small Vector class I made

class Vector{
    constructor(x, y, z) {
        if (x instanceof Vector) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        }
        this.x = x ?? 0;
        this.y = y ?? 0;
        this.z = z ?? 0;
    }

    add(v) {
        return new Vector(
            this.x + v.x,
            this.y + v.y,
            this.z + v.z
        );
    }

    sub(v) {
        return new Vector(
            this.x - v.x,
            this.y - v.y,
            this.z - v.z
        );
    }

    mult(v) {
        if (typeof (v) == "number") {
            return new Vector(
                this.x * v,
                this.y * v,
                this.z * v
            );
        } else return new Vector(
            this.x * v.x,
            this.y * v.y,
            this.z * v.z
        );
    }

    div(v) {
        if (typeof (v) == "number") {
            return new Vector(
                this.x / v,
                this.y / v,
                this.z / v
            );
        } else return new Vector(
            this.x / v.x,
            this.y / v.y,
            this.z / v.z
        );
    }

    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v) {
        return new Vector(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }

    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    }

    normalized() {
        return this.div(this.length());
    }

    toString() {
        return "(" + this.x + "," + this.y + "," + this.z + ")";
    }
}