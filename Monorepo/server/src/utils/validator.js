function requireFields( payload, fields = []){
    if (!payload || typeof payload !== "object"){
        const err = new Error("missing request body");
        err.status = 400;
        throw err;
    }
    for (const f of fields){
        const v = payload[f];
        if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")){
            const err = new Error(`missing required field: ${f}`);
            err.status = 400;
            throw err;
        }
    }
}

module.exports = { requireFields };
