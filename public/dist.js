System.register("wfc/superposition", [], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    function createSuperposition(numCoefficients, { width = 48, height = 48, periodic = true } = {}) {
        const wave = [];
        const changes = [];
        for (let i = 0; i < width * height; i++) {
            const w = [];
            for (let t = 0; t < numCoefficients; t++) {
                w.push(true);
            }
            wave.push(w);
            changes.push(false);
        }
        const stack = [];
        let stacksize = 0;
        const superposition = {
            width,
            height,
            numCoefficients,
            wave,
            periodic,
            change(i) {
                if (changes[i]) {
                    return;
                }
                stack[stacksize] = i;
                stacksize++;
                changes[i] = true;
            },
            getChange() {
                if (stacksize === 0) {
                    return null;
                }
                const i = stack[stacksize - 1];
                stacksize--;
                changes[i] = false;
                return i;
            },
            collapse(i, coefficient) {
                for (let t = 0; t < numCoefficients; t++) {
                    wave[i][t] = t === coefficient;
                }
                superposition.change(i);
            },
            setCoefficient(i, coefficient, state) {
                wave[i][coefficient] = state;
                superposition.change(i);
            },
            clear() {
                for (const w of wave) {
                    w.fill(true);
                }
            },
        };
        return superposition;
    }
    exports_1("createSuperposition", createSuperposition);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("wfc/overlappingModel", [], function (exports_2, context_2) {
    "use strict";
    var __moduleName = context_2 && context_2.id;
    function createOverlappingModel({ width, height, data }, { N = 3, periodicInput = true, symmetry = 8 } = {}) {
        const bitmap = new Uint32Array(data.buffer);
        const colors = [];
        const sample = [];
        for (const color of bitmap) {
            let i = 0;
            for (const c of colors) {
                if (c === color) {
                    break;
                }
                i++;
            }
            if (i === colors.length) {
                colors.push(color);
            }
            sample.push(i);
        }
        const pattern = (f) => {
            const result = [];
            for (let y = 0; y < N; y++) {
                for (let x = 0; x < N; x++) {
                    result.push(f(x, y));
                }
            }
            return result;
        };
        const patternFromSample = (x, y) => {
            return pattern((dx, dy) => sample[(x + dx) % width + ((y + dy) % height) * width]);
        };
        const rotate = (p) => pattern((x, y) => p[N - 1 - y + x * N]);
        const reflect = (p) => pattern((x, y) => p[N - 1 - x + y * N]);
        const C = colors.length;
        const W = C ** (N * N);
        const index = (p) => {
            let result = 0;
            let power = 1;
            for (let i = 0; i < p.length; i++) {
                result += p[p.length - 1 - i] * power;
                power *= C;
            }
            return result;
        };
        const patternFromIndex = (ind) => {
            let residue = ind;
            let power = W;
            const result = [];
            for (let i = 0; i < N * N; i++) {
                power /= C;
                let count = 0;
                while (residue >= power) {
                    residue -= power;
                    count++;
                }
                result.push(count);
            }
            return result;
        };
        const weights = new Map();
        const lenY = periodicInput ? height : height - N + 1;
        const lenX = periodicInput ? width : width - N + 1;
        for (let y = 0; y < lenY; y++) {
            for (let x = 0; x < lenX; x++) {
                const ps = [];
                ps[0] = patternFromSample(x, y);
                ps[1] = reflect(ps[0]);
                ps[2] = rotate(ps[0]);
                ps[3] = reflect(ps[2]);
                ps[4] = rotate(ps[2]);
                ps[5] = reflect(ps[4]);
                ps[6] = rotate(ps[4]);
                ps[7] = reflect(ps[6]);
                for (let k = 0; k < symmetry; k++) {
                    const ind = index(ps[k]);
                    const weight = weights.get(ind) || 0;
                    weights.set(ind, weight + 1);
                }
            }
        }
        const numCoefficients = weights.size;
        const patterns = [];
        const patternCount = [];
        for (const [ind, weight] of weights) {
            patterns.push(patternFromIndex(ind));
            patternCount.push(weight);
        }
        const agrees = (pattern1, pattern2, dx, dy) => {
            const xmin = dx < 0 ? 0 : dx;
            const xmax = dx < 0 ? dx + N : N;
            const ymin = dy < 0 ? 0 : dy;
            const ymax = dy < 0 ? dy + N : N;
            for (let y = ymin; y < ymax; y++) {
                for (let x = xmin; x < xmax; x++) {
                    if (pattern1[x + N * y] !== pattern2[x - dx + N * (y - dy)]) {
                        return false;
                    }
                }
            }
            return true;
        };
        const propagator = [];
        for (let x = 0; x < 2 * N - 1; x++) {
            propagator[x] = [];
            for (let y = 0; y < 2 * N - 1; y++) {
                propagator[x][y] = [];
                for (let t = 0; t < numCoefficients; t++) {
                    propagator[x][y][t] = [];
                    for (let t2 = 0; t2 < numCoefficients; t2++) {
                        if (agrees(patterns[t], patterns[t2], x - N + 1, y - N + 1)) {
                            propagator[x][y][t].push(t2);
                        }
                    }
                }
            }
        }
        return {
            numCoefficients,
            colors,
            N,
            patterns,
            propagator,
            patternCount,
        };
    }
    exports_2("createOverlappingModel", createOverlappingModel);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("wfc/setGround", [], function (exports_3, context_3) {
    "use strict";
    var __moduleName = context_3 && context_3.id;
    function setGround(ground = 0, { wave, width, height, numCoefficients, setCoefficient, collapse }) {
        if (ground === 0) {
            return;
        }
        ground = (ground + numCoefficients) % numCoefficients;
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height - 1; y++) {
                setCoefficient(x + y * width, ground, false);
            }
            collapse(x + (height - 1) * width, ground);
        }
    }
    exports_3("setGround", setGround);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("wfc/observe", [], function (exports_4, context_4) {
    "use strict";
    var sumFunc;
    var __moduleName = context_4 && context_4.id;
    function pickFromDistribution(array, r) {
        let sum = array.reduce(sumFunc);
        if (sum === 0) {
            array.fill(1);
            sum = array.reduce(sumFunc);
        }
        for (let i = 0; i < array.length; i++) {
            array[i] /= sum;
        }
        let x = 0;
        for (let i = 0; i < array.length; i++) {
            x += array[i];
            if (r <= x) {
                return i;
            }
        }
        return 0;
    }
    function createObservation({ patternCount, N }, { wave, width, height, numCoefficients, periodic, collapse }) {
        const logT = Math.log(numCoefficients);
        const distribution = [];
        return () => {
            let minEntropy = Infinity;
            let minEntropyWave = -1;
            for (let i = 0; i < wave.length; i++) {
                if (!periodic && (i % width + N > width || Math.floor(i / width) + N > height)) {
                    continue;
                }
                const w = wave[i];
                let amount = 0;
                let sum = 0;
                for (let t = 0; t < numCoefficients; t++) {
                    if (w[t]) {
                        amount += 1;
                        sum += patternCount[t];
                    }
                }
                if (sum === 0) {
                    return false;
                }
                const noise = 1e-6 * Math.random();
                let entropy;
                if (amount === 1) {
                    entropy = 0;
                }
                else {
                    let mainSum = 0;
                    for (let t = 0; t < numCoefficients; t++) {
                        if (w[t]) {
                            const p = patternCount[t] / sum;
                            mainSum += p * Math.log(p);
                        }
                    }
                    entropy = -mainSum / logT;
                }
                if (entropy > 0 && entropy + noise < minEntropy) {
                    minEntropy = entropy + noise;
                    minEntropyWave = i;
                }
            }
            if (minEntropyWave === -1) {
                return true;
            }
            for (let t = 0; t < numCoefficients; t++) {
                distribution[t] = wave[minEntropyWave][t] ? patternCount[t] : 0;
            }
            const r = pickFromDistribution(distribution, Math.random());
            collapse(minEntropyWave, r);
            return null;
        };
    }
    exports_4("createObservation", createObservation);
    return {
        setters: [],
        execute: function () {
            sumFunc = (a, b) => a + b;
        }
    };
});
System.register("wfc/propagate", [], function (exports_5, context_5) {
    "use strict";
    var __moduleName = context_5 && context_5.id;
    function propagate({ N, propagator }, { wave, width, height, numCoefficients, periodic, setCoefficient, getChange }) {
        const i1 = getChange();
        if (i1 === null) {
            return null;
        }
        const w1 = wave[i1];
        const x1 = i1 % width;
        const y1 = Math.floor(i1 / width);
        for (let dx = -N + 1; dx < N; dx++) {
            for (let dy = -N + 1; dy < N; dy++) {
                let x2 = x1 + dx;
                if (x2 < 0) {
                    x2 += width;
                }
                else if (x2 >= width) {
                    x2 -= width;
                }
                let y2 = y1 + dy;
                if (y2 < 0) {
                    y2 += height;
                }
                else if (y2 >= height) {
                    y2 -= height;
                }
                const i2 = x2 + y2 * width;
                if (!periodic && (i2 % width + N > width || Math.floor(i2 / width) + N > height)) {
                    continue;
                }
                const w2 = wave[i2];
                const prop = propagator[N - 1 - dx][N - 1 - dy];
                for (let t = 0; t < numCoefficients; t++) {
                    if (!w2[t]) {
                        continue;
                    }
                    let b = false;
                    const p = prop[t];
                    for (let l = 0; !b && l < p.length; l++) {
                        b = w1[p[l]];
                    }
                    if (!b) {
                        setCoefficient(i2, t, false);
                    }
                }
            }
        }
        return i1;
    }
    exports_5("propagate", propagate);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("wfc/render", [], function (exports_6, context_6) {
    "use strict";
    var __moduleName = context_6 && context_6.id;
    function orderedArraySum(array) {
        const sorted = array.slice().sort((a, b) => b - a);
        const sum = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            sum[i] = sum[i - 1] + sorted[i];
        }
        return sum;
    }
    function drawPixelFromColor(ctx, x, y, color) {
        ctx.fillStyle = `rgb(${color & 255},${(color >> 8) & 255},${(color >> 16) & 255})`;
        ctx.fillRect(x, y, 1, 1);
    }
    function createRender({ colors, patterns, patternCount, N }, { wave, width, height, periodic }, ctx) {
        const maxPatternCount = orderedArraySum(patternCount);
        return (waveIndex) => {
            const w = wave[waveIndex];
            let activeCoefficients = 0;
            let sum = 0;
            let lastPatternIndex = 0;
            const angleConstant = 2 * Math.PI / w.length;
            let hueX = 0;
            let hueY = 0;
            for (let i = 0; i < w.length; i++) {
                if (w[i]) {
                    activeCoefficients++;
                    sum += patternCount[i];
                    lastPatternIndex = i;
                    hueX += Math.cos(angleConstant * i);
                    hueY += Math.sin(angleConstant * i);
                }
            }
            const x = waveIndex % width;
            const y = Math.floor(waveIndex / width);
            if (activeCoefficients === 1) {
                const pattern = patterns[lastPatternIndex];
                if (!periodic && (x >= width - N || y >= height - N)) {
                    for (let i = 0; i < N; i++) {
                        for (let j = 0; j < N; j++) {
                            drawPixelFromColor(ctx, x + i, y + j, colors[pattern[i + j * N]]);
                        }
                    }
                }
                else {
                    drawPixelFromColor(ctx, x, y, colors[pattern[0]]);
                }
            }
            else {
                // circular average of active coefficients
                const hue = 180 * (Math.PI + Math.atan2(hueY, hueX)) / Math.PI;
                const saturation = 100 * (sum / maxPatternCount[activeCoefficients]);
                const lightness = Math.round(80 - 80 * activeCoefficients / w.length);
                ctx.fillStyle = `hsl(${hue},${saturation}%,${lightness}%)`;
                ctx.fillRect(x, y, 1, 1);
            }
        };
    }
    exports_6("createRender", createRender);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("wfc/run", ["wfc/superposition", "wfc/overlappingModel", "wfc/setGround", "wfc/observe", "wfc/propagate", "wfc/render"], function (exports_7, context_7) {
    "use strict";
    var superposition_1, overlappingModel_1, setGround_1, observe_1, propagate_1, render_1, targetFps, targetTime;
    var __moduleName = context_7 && context_7.id;
    function createWaveFunctionCollapse(image, canvas, { periodicInput, periodicOutput, outputWidth, outputHeight, N, symmetry, ground }, onComplete) {
        const model = overlappingModel_1.createOverlappingModel(image, { N, symmetry, periodicInput });
        const superpos = superposition_1.createSuperposition(model.numCoefficients, { width: outputWidth, height: outputHeight, periodic: periodicOutput });
        const observe = observe_1.createObservation(model, superpos);
        canvas.width = superpos.width;
        canvas.height = superpos.height;
        const ctx = canvas.getContext("2d");
        const clear = () => {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            superpos.clear();
            setGround_1.setGround(ground, superpos);
        };
        const render = render_1.createRender(model, superpos, ctx);
        let propagating = false;
        let propagationLoops = 1;
        let animationFrameId;
        const tick = () => {
            if (!propagating) {
                const result = observe();
                if (result === null) {
                    propagating = true;
                }
                else if (result === false) {
                    clear();
                }
                else {
                    // Generation completed successfully
                    if (onComplete) {
                        onComplete();
                    }
                    return;
                }
            }
            else {
                const time = Date.now();
                for (let i = 0; propagating && i < propagationLoops; i++) {
                    const waveIndex = propagate_1.propagate(model, superpos);
                    if (waveIndex === null) {
                        propagating = false;
                        // Generation completed via propagation
                        if (onComplete) {
                            onComplete();
                        }
                    }
                    else {
                        render(waveIndex);
                    }
                }
                if (propagating) {
                    const elapsed = Date.now() - time;
                    if (elapsed > targetTime) {
                        propagationLoops = Math.max(1, propagationLoops - 1);
                    }
                    else {
                        propagationLoops++;
                    }
                }
            }
            animationFrameId = requestAnimationFrame(tick);
        };
        clear();
        tick();
        return {
            stop() {
                cancelAnimationFrame(animationFrameId);
            },
        };
    }
    exports_7("createWaveFunctionCollapse", createWaveFunctionCollapse);
    return {
        setters: [
            function (superposition_1_1) {
                superposition_1 = superposition_1_1;
            },
            function (overlappingModel_1_1) {
                overlappingModel_1 = overlappingModel_1_1;
            },
            function (setGround_1_1) {
                setGround_1 = setGround_1_1;
            },
            function (observe_1_1) {
                observe_1 = observe_1_1;
            },
            function (propagate_1_1) {
                propagate_1 = propagate_1_1;
            },
            function (render_1_1) {
                render_1 = render_1_1;
            }
        ],
        execute: function () {
            targetFps = 45;
            targetTime = 1000 / targetFps;
        }
    };
});
System.register("util", [], function (exports_8, context_8) {
    "use strict";
    var __moduleName = context_8 && context_8.id;
    function buildDomTree(parent, children) {
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child instanceof Array) {
                const innerParent = children[i - 1];
                if (innerParent instanceof Node) {
                    buildDomTree(innerParent, child);
                }
                else {
                    console.warn("buildDomTree: Invalid argument format. Array must follow a Node");
                }
            }
            else {
                parent.appendChild(child instanceof Node ? child : document.createTextNode(child.toString()));
            }
        }
        return parent;
    }
    exports_8("buildDomTree", buildDomTree);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("components/component", [], function (exports_9, context_9) {
    "use strict";
    var __moduleName = context_9 && context_9.id;
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("components/inputs", ["util"], function (exports_10, context_10) {
    "use strict";
    var util_1;
    var __moduleName = context_10 && context_10.id;
    function createNumberInput(labelText, props = {}, integer = true) {
        const input = document.createElement("input");
        Object.assign(input, props, { type: "number" });
        return {
            domElement: util_1.buildDomTree(Object.assign(document.createElement("label"), { className: "numberInputComponent" }), [
                `${labelText} `,
                input,
            ]),
            get value() {
                return integer ? parseInt(input.value, 10) : parseFloat(input.value);
            },
            set value(x) {
                input.value = x.toString();
            },
            // TODO: add onInput property
        };
    }
    exports_10("createNumberInput", createNumberInput);
    function createCheckboxInput(labelText, props = {}) {
        const input = document.createElement("input");
        Object.assign(input, props, { type: "checkbox" });
        return {
            domElement: util_1.buildDomTree(Object.assign(document.createElement("label"), { className: "checkboxInputComponent" }), [
                input,
                labelText,
            ]),
            get value() {
                return input.checked;
            },
            set value(x) {
                input.checked = x;
            },
            // TODO: add onInput property
        };
    }
    exports_10("createCheckboxInput", createCheckboxInput);
    function createRadioInput(radioName, choices, id) {
        const domElement = document.createElement("div");
        domElement.className = "radioComponent";
        domElement.textContent = `${radioName} `;
        id = id || radioName;
        const inputs = [];
        for (let i = 0; i < choices.length; i++) {
            const { label, value } = choices[i];
            const input = document.createElement("input");
            inputs.push(input);
            input.type = "radio";
            input.name = id;
            if (i === 0) {
                input.checked = true;
            }
            domElement.appendChild(util_1.buildDomTree(document.createElement("label"), [input, label]));
        }
        return {
            domElement,
            get value() {
                for (let i = 0; i < inputs.length; i++) {
                    if (inputs[i].checked) {
                        return choices[i].value;
                    }
                }
                return choices[0].value;
            },
            set value(x) {
                for (let i = 0; i < choices.length; i++) {
                    if (choices[i].value === x) {
                        inputs[i].checked = true;
                    }
                }
            },
            // TODO: add onInput property
        };
    }
    exports_10("createRadioInput", createRadioInput);
    function createSelectInput(selectName, choices) {
        const selectElem = document.createElement("select");
        const options = [];
        const emptyOption = document.createElement("option");
        emptyOption.disabled = true;
        emptyOption.selected = true;
        emptyOption.style.display = "none";
        selectElem.append(emptyOption);
        for (const { label, value } of choices) {
            const option = document.createElement("option");
            option.textContent = label;
            selectElem.appendChild(option);
            options.push(option);
        }
        let onInput;
        const selectInput = {
            domElement: util_1.buildDomTree(Object.assign(document.createElement("label"), { className: "selectComponent" }), [
                `${selectName} `,
                selectElem,
            ]),
            get value() {
                for (let i = 0; i < options.length; i++) {
                    if (options[i].selected) {
                        return choices[i].value;
                    }
                }
                return choices[0].value;
            },
            set value(x) {
                for (let i = 0; i < choices.length; i++) {
                    if (choices[i].value === x) {
                        options[i].selected = true;
                    }
                }
            },
            get onInput() {
                return onInput;
            },
            set onInput(fn) {
                onInput = fn;
                selectElem.onchange = fn ? () => fn(selectInput.value) : undefined;
            },
            deselect() {
                emptyOption.selected = true;
            },
        };
        return selectInput;
    }
    exports_10("createSelectInput", createSelectInput);
    return {
        setters: [
            function (util_1_1) {
                util_1 = util_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/common", [], function (exports_11, context_11) {
    "use strict";
    var __moduleName = context_11 && context_11.id;
    function inputGroup() {
        const div = document.createElement("div");
        div.className = "inputGroup";
        return div;
    }
    exports_11("inputGroup", inputGroup);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("components/wfcOptions", ["util", "components/inputs", "components/common"], function (exports_12, context_12) {
    "use strict";
    var util_2, inputs_1, common_1;
    var __moduleName = context_12 && context_12.id;
    function createWfcOptions() {
        const domElement = document.createElement("div");
        domElement.className = "wfcInputComponent";
        const components = {
            N: inputs_1.createRadioInput("Pattern size", [
                { label: "2", value: 2 },
                { label: "3", value: 3 },
                { label: "4", value: 4 },
            ]),
            symmetry: inputs_1.createRadioInput("Extra symmetry", [
                { label: "None", value: 1 },
                { label: "Reflections", value: 2 },
                { label: "Reflections and Rotations", value: 8 },
            ]),
            ground: inputs_1.createNumberInput("Ground", { min: "-9999", max: "9999", step: "1" }),
            periodicInput: inputs_1.createCheckboxInput("Periodic"),
            periodicOutput: inputs_1.createCheckboxInput("Periodic"),
            outputWidth: inputs_1.createNumberInput("Width", { min: "0", max: "128", step: "1" }),
            outputHeight: inputs_1.createNumberInput("Height", { min: "0", max: "128", step: "1" }),
        };
        const tooltips = {
            N: "The width and height, in pixels, of each pattern sampled from the input bitmap. A higher value captures bigger features of the input, but runs more slowly.",
            symmetry: "Add extra patterns by reflecting or rotating each pattern sampled from the input bitmap.",
            ground: "Set the bottom row of output pixels to the pattern indexed by this number. Negative numbers are supported and start from the end of the pattern list. 0 for no ground pattern.",
            periodicInput: "Checking indicates that the input bitmap is tileable and wraps around its edges",
            periodicOutput: "Checking produces an output bitmap that tiles and wraps around its edges",
            outputWidth: "The width, in pixels, of the output bitmap",
            outputHeight: "The height, in pixels, of the output bitmap",
        };
        for (const k in tooltips) {
            components[k].domElement.title = tooltips[k];
        }
        const wfcOptions = {
            domElement: util_2.buildDomTree(domElement, [
                document.createElement("fieldset"), [
                    document.createElement("legend"), ["Input Bitmap"],
                    common_1.inputGroup(), [
                        components.periodicInput.domElement,
                    ],
                    common_1.inputGroup(), [
                        components.N.domElement,
                    ],
                    common_1.inputGroup(), [
                        components.symmetry.domElement,
                    ],
                    common_1.inputGroup(), [
                        components.ground.domElement,
                    ],
                ],
                document.createElement("fieldset"), [
                    document.createElement("legend"), ["Output Bitmap"],
                    common_1.inputGroup(), [
                        components.periodicOutput.domElement,
                    ],
                    common_1.inputGroup(), [
                        components.outputWidth.domElement,
                        components.outputHeight.domElement,
                    ],
                ],
            ]),
            get options() {
                const vals = {};
                for (const k in components) {
                    vals[k] = components[k].value;
                }
                return vals;
            },
            set options(x) {
                for (const k in components) {
                    const val = x[k];
                    if (val !== undefined) {
                        components[k].value = x[k];
                    }
                }
            },
            updateOptions(x) {
                wfcOptions.options = x;
            },
        };
        wfcOptions.options = {
            N: 3,
            symmetry: 8,
            ground: 0,
            periodicInput: true,
            periodicOutput: true,
            outputWidth: 48,
            outputHeight: 48,
        };
        return wfcOptions;
    }
    exports_12("createWfcOptions", createWfcOptions);
    return {
        setters: [
            function (util_2_1) {
                util_2 = util_2_1;
            },
            function (inputs_1_1) {
                inputs_1 = inputs_1_1;
            },
            function (common_1_1) {
                common_1 = common_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("getImageData", [], function (exports_13, context_13) {
    "use strict";
    var __moduleName = context_13 && context_13.id;
    function getImageData(url) {
        const img = document.createElement("img");
        img.src = url;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        return new Promise((resolve, reject) => {
            img.addEventListener("load", () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
            });
        });
    }
    exports_13("default", getImageData);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("presets", [], function (exports_14, context_14) {
    "use strict";
    var presetDefaults, presets;
    var __moduleName = context_14 && context_14.id;
    function getPresetPath(name) {
        return `images/${name}.png`;
    }
    exports_14("getPresetPath", getPresetPath);
    return {
        setters: [],
        execute: function () {
            exports_14("presetDefaults", presetDefaults = {
                name: "",
                N: 3,
                symmetry: 8,
                ground: 0,
                periodicInput: true,
                periodicOutput: true,
                outputWidth: 48,
                outputHeight: 48,
            });
            exports_14("presets", presets = [
                { name: "3Bricks", symmetry: 1 },
                { name: "Angular" },
                { name: "Cat", symmetry: 2, outputWidth: 80, outputHeight: 80 },
                { name: "Cats", symmetry: 2 },
                { name: "Cave" },
                { name: "Chess", N: 2 },
                { name: "City", outputWidth: 80, outputHeight: 80 },
                { name: "Colored City" },
                { name: "Dungeon" },
                { name: "Fabric" },
                { name: "Flowers", symmetry: 2, ground: -4 },
                { name: "Forest" },
                { name: "Hogs", N: 2 },
                { name: "Knot" },
                { name: "Lake", outputWidth: 60, outputHeight: 60 },
                { name: "Less Rooms" },
                { name: "Link" },
                { name: "Link 2" },
                { name: "Magic Office" },
                { name: "Maze" },
                { name: "Mazelike" },
                { name: "More Flowers", symmetry: 2, ground: -4 },
                { name: "Mountains", symmetry: 2 },
                { name: "Nested" },
                { name: "Office" },
                { name: "Office 2" },
                { name: "Paths" },
                { name: "Platformer", symmetry: 2, ground: -1, outputWidth: 80, outputHeight: 32 },
                { name: "Qud", outputWidth: 80, outputHeight: 80 },
                { name: "Red Dot" },
                { name: "Red Maze", N: 2 },
                { name: "Rooms" },
                { name: "Rule 126", N: 4, symmetry: 2, periodicInput: false, periodicOutput: false },
                { name: "Scaled Maze", N: 2 },
                { name: "Sewers" },
                { name: "Simple Knot" },
                { name: "Simple Maze", N: 2 },
                { name: "Simple Wall", symmetry: 2 },
                { name: "Skew 1" },
                { name: "Skew 2" },
                { name: "Skyline", symmetry: 2, ground: -1, outputWidth: 50, outputHeight: 30 },
                { name: "Skyline 2", symmetry: 2, ground: -1, outputWidth: 50, outputHeight: 30 },
                { name: "Smile City" },
                { name: "Spirals" },
                { name: "Town" },
                { name: "Trick Knot" },
                { name: "Village", symmetry: 2 },
                { name: "Water", symmetry: 1 },
            ]);
        }
    };
});
System.register("components/presetPicker", ["getImageData", "util", "components/inputs", "components/common", "presets"], function (exports_15, context_15) {
    "use strict";
    var getImageData_1, util_3, inputs_2, common_2, presets_1;
    var __moduleName = context_15 && context_15.id;
    function createPresetPicker() {
        const presetPicker = {
            domElement: Object.assign(document.createElement("div"), { className: "presetPickerComponent" }),
        };
        const onPick = (image, options) => {
            if (presetPicker.onPick) {
                presetPicker.onPick(image, options);
            }
        };
        const previewImage = document.createElement("img");
        previewImage.className = "presetPreview";
        previewImage.style.display = "none";
        const imageInput = document.createElement("input");
        imageInput.type = "file";
        imageInput.accept = "image/*";
        const presetChoices = [];
        for (const preset of presets_1.presets) {
            presetChoices.push({ label: preset.name || "", value: preset });
        }
        const presetSelect = inputs_2.createSelectInput("Preset", presetChoices);
        imageInput.onchange = () => {
            if (imageInput.files) {
                const path = URL.createObjectURL(imageInput.files[0]);
                getImageData_1.default(path).then((image) => onPick(image, {}));
                presetSelect.deselect();
                previewImage.src = path;
                previewImage.style.display = "";
            }
        };
        presetSelect.onInput = (value) => {
            imageInput.value = "";
            const preset = { ...presets_1.presetDefaults, ...value };
            const path = presets_1.getPresetPath(preset.name);
            getImageData_1.default(path).then((image) => onPick(image, preset));
            previewImage.src = path;
            previewImage.style.display = "";
        };
        util_3.buildDomTree(presetPicker.domElement, [
            document.createElement("p"), [
                "Select a preset or upload a custom image. Custom images should be simple - e.g. less than 64x64 pixels, with only a handful of colors.",
            ],
            common_2.inputGroup(), [
                presetSelect.domElement,
            ],
            common_2.inputGroup(), [
                document.createElement("label"), [
                    "Custom Bitmap ", imageInput,
                ],
            ],
            previewImage,
        ]);
        return presetPicker;
    }
    exports_15("createPresetPicker", createPresetPicker);
    return {
        setters: [
            function (getImageData_1_1) {
                getImageData_1 = getImageData_1_1;
            },
            function (util_3_1) {
                util_3 = util_3_1;
            },
            function (inputs_2_1) {
                inputs_2 = inputs_2_1;
            },
            function (common_2_1) {
                common_2 = common_2_1;
            },
            function (presets_1_1) {
                presets_1 = presets_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/drawingCanvas", ["util", "components/common"], function (exports_16, context_16) {
    "use strict";
    var util_4, common_3;
    var __moduleName = context_16 && context_16.id;
    function createDrawingCanvas() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "drawingCanvasComponent" }),
            getImageData: () => {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                return imageData;
            },
            clear: () => {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };
        // Drawing state
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        let currentTool = 'pen';
        let currentColor = '#000000';
        let lineWidth = 2;
        let startX = 0;
        let startY = 0;
        let canvasSize = 32;
        let scaleFactor = 16; // Display scale - increased for better pixel visibility
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        canvas.className = "drawingCanvas";
        canvas.style.border = "1px solid #ccc";
        canvas.style.cursor = "crosshair";
        canvas.style.width = `${canvasSize * scaleFactor}px`;
        canvas.style.height = `${canvasSize * scaleFactor}px`;
        canvas.style.imageRendering = "pixelated";
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Canvas size selection
        const sizeSelect = document.createElement("select");
        sizeSelect.innerHTML = `
    <option value="16">16x16</option>
    <option value="32">32x32</option>
    <option value="64">64x64</option>
  `;
        sizeSelect.value = canvasSize.toString();
        sizeSelect.onchange = () => {
            canvasSize = parseInt(sizeSelect.value);
            updateCanvasSize();
        };
        // Tool selection
        const toolSelect = document.createElement("select");
        toolSelect.innerHTML = `
    <option value="pen">Pen</option>
    <option value="eraser">Eraser</option>
    <option value="bucket">Paint Bucket</option>
    <option value="rectangle">Rectangle</option>
    <option value="circle">Circle</option>
    <option value="line">Line</option>
    <option value="spray">Spray</option>
  `;
        toolSelect.value = currentTool;
        toolSelect.onchange = () => {
            currentTool = toolSelect.value;
            canvas.style.cursor = currentTool === 'eraser' ? 'not-allowed' :
                currentTool === 'bucket' ? 'pointer' : 'crosshair';
        };
        // Color picker
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = currentColor;
        colorInput.onchange = () => {
            currentColor = colorInput.value;
        };
        // Line width slider
        const widthLabel = document.createElement("label");
        widthLabel.textContent = "Size: ";
        const widthInput = document.createElement("input");
        widthInput.type = "range";
        widthInput.min = "1";
        widthInput.max = "20";
        widthInput.value = lineWidth.toString();
        widthInput.oninput = () => {
            lineWidth = parseInt(widthInput.value);
        };
        // Clear button
        const clearButton = document.createElement("input");
        clearButton.type = "button";
        clearButton.value = "Clear Canvas";
        clearButton.onclick = () => {
            component.clear();
        };
        // Use drawing button
        const useDrawingButton = document.createElement("input");
        useDrawingButton.type = "button";
        useDrawingButton.value = "Use This Drawing";
        useDrawingButton.onclick = () => {
            const imageData = component.getImageData();
            if (imageData && component.onDrawComplete) {
                component.onDrawComplete(imageData);
            }
        };
        // Helper functions
        function updateCanvasSize() {
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            canvas.style.width = `${canvasSize * scaleFactor}px`;
            canvas.style.height = `${canvasSize * scaleFactor}px`;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        function getCanvasCoordinates(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
        // Drawing functions
        function startDrawing(e) {
            isDrawing = true;
            const coords = getCanvasCoordinates(e);
            [lastX, lastY] = [coords.x, coords.y];
            [startX, startY] = [coords.x, coords.y];
            if ((currentTool === 'pen' || currentTool === 'eraser') && lineWidth === 1) {
                // For pixel-perfect pen with size 1, draw immediately on click
                ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
                ctx.fillRect(Math.floor(coords.x), Math.floor(coords.y), 1, 1);
            }
            else if (currentTool === 'pen' || currentTool === 'eraser') {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
            }
            else if (currentTool === 'bucket') {
                // For bucket tool, fill immediately on click
                floodFill(Math.floor(coords.x), Math.floor(coords.y), currentColor);
                isDrawing = false;
            }
        }
        function draw(e) {
            if (!isDrawing)
                return;
            const coords = getCanvasCoordinates(e);
            const x = coords.x;
            const y = coords.y;
            ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
            switch (currentTool) {
                case 'pen':
                case 'eraser':
                    if (lineWidth === 1) {
                        // Pixel-perfect drawing for size 1 - only draw if moved to a different pixel
                        const currentPixelX = Math.floor(x);
                        const currentPixelY = Math.floor(y);
                        const lastPixelX = Math.floor(lastX);
                        const lastPixelY = Math.floor(lastY);
                        if (currentPixelX !== lastPixelX || currentPixelY !== lastPixelY) {
                            ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
                            ctx.fillRect(currentPixelX, currentPixelY, 1, 1);
                        }
                    }
                    else {
                        // Normal line drawing for larger sizes
                        ctx.lineWidth = lineWidth;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.lineTo(x, y);
                        ctx.stroke();
                    }
                    break;
                case 'spray':
                    sprayPaint(x, y);
                    break;
            }
            [lastX, lastY] = [x, y];
        }
        function stopDrawing(e) {
            if (!isDrawing)
                return;
            isDrawing = false;
            const coords = getCanvasCoordinates(e);
            const x = coords.x;
            const y = coords.y;
            switch (currentTool) {
                case 'rectangle':
                    drawRectangle(startX, startY, x, y);
                    break;
                case 'circle':
                    drawCircle(startX, startY, x, y);
                    break;
                case 'line':
                    drawLine(startX, startY, x, y);
                    break;
            }
        }
        function sprayPaint(x, y) {
            const density = 50;
            const radius = lineWidth * 2;
            for (let i = 0; i < density; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                const sprayX = x + Math.cos(angle) * distance;
                const sprayY = y + Math.sin(angle) * distance;
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(sprayX, sprayY, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        function drawRectangle(x1, y1, x2, y2) {
            const width = x2 - x1;
            const height = y2 - y1;
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x1, y1, width, height);
        }
        function drawCircle(x1, y1, x2, y2) {
            const radius = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(x1, y1, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        function drawLine(x1, y1, x2, y2) {
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        function floodFill(startX, startY, fillColor) {
            // Get the image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            // Convert fill color to RGB
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = fillColor;
            tempCtx.fillRect(0, 0, 1, 1);
            const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
            const fillR = fillData[0];
            const fillG = fillData[1];
            const fillB = fillData[2];
            // Get the color we're replacing
            const startIndex = (startY * canvas.width + startX) * 4;
            const targetR = data[startIndex];
            const targetG = data[startIndex + 1];
            const targetB = data[startIndex + 2];
            // Don't fill if the target color is the same as fill color
            if (targetR === fillR && targetG === fillG && targetB === fillB) {
                return;
            }
            // Flood fill using stack-based approach
            const stack = [[startX, startY]];
            const visited = new Set();
            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const key = `${x},${y}`;
                if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
                    continue;
                }
                const index = (y * canvas.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                // Check if this pixel matches the target color
                if (r === targetR && g === targetG && b === targetB) {
                    // Fill the pixel
                    data[index] = fillR;
                    data[index + 1] = fillG;
                    data[index + 2] = fillB;
                    data[index + 3] = 255; // Alpha
                    visited.add(key);
                    // Add adjacent pixels to stack
                    stack.push([x + 1, y]);
                    stack.push([x - 1, y]);
                    stack.push([x, y + 1]);
                    stack.push([x, y - 1]);
                }
            }
            // Put the modified image data back
            ctx.putImageData(imageData, 0, 0);
        }
        // Event listeners
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        // Build DOM
        util_4.buildDomTree(component.domElement, [
            document.createElement("p"), [
                "Create a custom image for wave function collapse. Draw simple patterns with distinct colors."
            ],
            common_3.inputGroup(), [
                document.createElement("label"), ["Canvas Size: ", sizeSelect],
                document.createElement("label"), ["Tool: ", toolSelect],
                document.createElement("label"), ["Color: ", colorInput],
                widthLabel, widthInput,
            ],
            common_3.inputGroup(), [
                clearButton,
                useDrawingButton,
            ],
            canvas,
        ]);
        return component;
    }
    exports_16("createDrawingCanvas", createDrawingCanvas);
    return {
        setters: [
            function (util_4_1) {
                util_4 = util_4_1;
            },
            function (common_3_1) {
                common_3 = common_3_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("colorMapping", [], function (exports_17, context_17) {
    "use strict";
    var GameElement, DEFAULT_COLOR_MAPPINGS;
    var __moduleName = context_17 && context_17.id;
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    exports_17("hexToRgb", hexToRgb);
    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    exports_17("rgbToHex", rgbToHex);
    function colorDistance(color1, color2) {
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2));
    }
    exports_17("colorDistance", colorDistance);
    // Find the closest matching color from the mapping
    function findClosestColor(r, g, b, mappings) {
        const targetColor = { r, g, b };
        let closestElement = GameElement.FLOOR; // Default
        let minDistance = Infinity;
        for (const [hexColor, element] of Object.entries(mappings)) {
            const rgbColor = hexToRgb(hexColor);
            if (rgbColor) {
                const distance = colorDistance(targetColor, rgbColor);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestElement = element;
                }
            }
        }
        return closestElement;
    }
    exports_17("findClosestColor", findClosestColor);
    // Convert image data to game map
    function imageDataToGameMap(imageData, mappings = DEFAULT_COLOR_MAPPINGS) {
        const { data, width, height } = imageData;
        const gameMap = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                const element = findClosestColor(r, g, b, mappings);
                row.push(element);
            }
            gameMap.push(row);
        }
        return gameMap;
    }
    exports_17("imageDataToGameMap", imageDataToGameMap);
    // Find player start position
    function findPlayerStart(gameMap) {
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                if (gameMap[y][x] === GameElement.PLAYER_START) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    exports_17("findPlayerStart", findPlayerStart);
    // Find player finish position
    function findPlayerFinish(gameMap) {
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                if (gameMap[y][x] === GameElement.PLAYER_FINISH) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    exports_17("findPlayerFinish", findPlayerFinish);
    // Get all enemy positions
    function findEnemies(gameMap) {
        const enemies = [];
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                if (gameMap[y][x] === GameElement.ENEMY) {
                    enemies.push({ x, y });
                }
            }
        }
        return enemies;
    }
    exports_17("findEnemies", findEnemies);
    // Check if a position is walkable (not a wall)
    function isWalkable(gameMap, x, y) {
        if (y < 0 || y >= gameMap.length || x < 0 || x >= gameMap[y].length) {
            return false;
        }
        const element = gameMap[y][x];
        return element !== GameElement.WALL && element !== GameElement.DOOR;
    }
    exports_17("isWalkable", isWalkable);
    function getElementProperties(element) {
        switch (element) {
            case GameElement.WALL:
                return {
                    walkable: false,
                    dangerous: false,
                    collectible: false,
                    interactive: false,
                    description: "A solid wall blocking your path."
                };
            case GameElement.DANGER:
                return {
                    walkable: true,
                    dangerous: true,
                    collectible: false,
                    interactive: false,
                    description: "Dangerous terrain that damages you when stepped on."
                };
            case GameElement.WATER:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: false,
                    description: "Water that slows your movement."
                };
            case GameElement.ENEMY:
                return {
                    walkable: true,
                    dangerous: true,
                    collectible: false,
                    interactive: true,
                    description: "An enemy that will attack you on sight."
                };
            case GameElement.GRASS:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: false,
                    description: "Soft grass that cushions your steps."
                };
            case GameElement.FIRE:
                return {
                    walkable: true,
                    dangerous: true,
                    collectible: false,
                    interactive: false,
                    description: "Burning fire that damages you when stepped on."
                };
            case GameElement.PLAYER_START:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: false,
                    description: "Your starting position in the dungeon."
                };
            case GameElement.PLAYER_FINISH:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: true,
                    description: "The exit from the dungeon."
                };
            case GameElement.TREASURE:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: true,
                    interactive: false,
                    description: "Valuable treasure waiting to be collected."
                };
            case GameElement.KEY:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: true,
                    interactive: false,
                    description: "A key that can open locked doors."
                };
            case GameElement.DOOR:
                return {
                    walkable: false,
                    dangerous: false,
                    collectible: false,
                    interactive: true,
                    description: "A locked door that requires a key to open."
                };
            case GameElement.STAIRS:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: true,
                    description: "Stairs leading to another level."
                };
            case GameElement.FLOOR:
            default:
                return {
                    walkable: true,
                    dangerous: false,
                    collectible: false,
                    interactive: false,
                    description: "Regular dungeon floor."
                };
        }
    }
    exports_17("getElementProperties", getElementProperties);
    return {
        setters: [],
        execute: function () {
            // Color mapping system for converting image colors to game elements
            (function (GameElement) {
                GameElement["WALL"] = "wall";
                GameElement["DANGER"] = "danger";
                GameElement["WATER"] = "water";
                GameElement["ENEMY"] = "enemy";
                GameElement["GRASS"] = "grass";
                GameElement["FIRE"] = "fire";
                GameElement["PLAYER_START"] = "player_start";
                GameElement["PLAYER_FINISH"] = "player_finish";
                GameElement["FLOOR"] = "floor";
                GameElement["TREASURE"] = "treasure";
                GameElement["KEY"] = "key";
                GameElement["DOOR"] = "door";
                GameElement["STAIRS"] = "stairs";
            })(GameElement || (exports_17("GameElement", GameElement = {})));
            // Default color mappings based on user requirements
            exports_17("DEFAULT_COLOR_MAPPINGS", DEFAULT_COLOR_MAPPINGS = {
                '#000000': GameElement.WALL, // Black - wall
                '#FF0000': GameElement.DANGER, // Red - danger
                '#0000FF': GameElement.WATER, // Blue - water
                '#800080': GameElement.ENEMY, // Purple - enemy
                '#008000': GameElement.GRASS, // Green - grass
                '#FFA500': GameElement.FIRE, // Orange - fire
                '#006400': GameElement.PLAYER_START, // Dark green - player start
                '#8B0000': GameElement.PLAYER_FINISH, // Dark red - player finish
                // Additional mappings for more variety
                '#FFFF00': GameElement.TREASURE, // Yellow - treasure
                '#FFD700': GameElement.KEY, // Gold - key
                '#8B4513': GameElement.DOOR, // Brown - door
                '#C0C0C0': GameElement.STAIRS, // Silver - stairs
                '#FFFFFF': GameElement.FLOOR, // White - floor (default)
            });
        }
    };
});
System.register("components/colorReference", ["colorMapping"], function (exports_18, context_18) {
    "use strict";
    var colorMapping_1;
    var __moduleName = context_18 && context_18.id;
    function createColorReference() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "colorReferenceComponent" }),
            updateMappings: (mappings = colorMapping_1.DEFAULT_COLOR_MAPPINGS) => {
                updateColorGrid(mappings);
            }
        };
        // Color mapping descriptions
        const colorDescriptions = {
            '#000000': 'Wall (impassable)',
            '#FF0000': 'Danger (damage over time)',
            '#0000FF': 'Water (slows movement)',
            '#800080': 'Enemy (attacks on contact)',
            '#008000': 'Grass (safe terrain)',
            '#FFA500': 'Fire (dangerous)',
            '#006400': 'Player Start',
            '#8B0000': 'Player Finish/Exit',
            '#FFFF00': 'Treasure (collectible)',
            '#FFD700': 'Key (unlocks doors)',
            '#8B4513': 'Door (locked, needs key)',
            '#C0C0C0': 'Stairs (interactive)',
            '#FFFFFF': 'Floor (default)'
        };
        function updateColorGrid(mappings) {
            // Clear existing content
            component.domElement.innerHTML = '';
            const colorGrid = document.createElement("div");
            colorGrid.className = "colorGrid";
            const title = document.createElement("h4");
            title.textContent = "Color Reference Guide";
            title.style.marginBottom = "10px";
            colorGrid.appendChild(title);
            // Sort colors by their hex value for consistent display
            const sortedColors = Object.entries(mappings).sort(([a], [b]) => a.localeCompare(b));
            sortedColors.forEach(([hexColor, gameElement]) => {
                const colorItem = document.createElement("div");
                colorItem.className = "colorItem";
                const colorSwatch = document.createElement("div");
                colorSwatch.className = "colorSwatch";
                colorSwatch.style.backgroundColor = hexColor;
                colorSwatch.style.cursor = "pointer";
                // Add border for white color to make it visible
                if (hexColor === '#FFFFFF') {
                    colorSwatch.style.border = "1px solid #ccc";
                }
                // Make swatch clickable
                colorSwatch.onclick = () => {
                    if (component.onColorSelect) {
                        component.onColorSelect(hexColor);
                    }
                };
                // Add hover effect
                colorSwatch.onmouseenter = () => {
                    colorSwatch.style.transform = "scale(1.1)";
                    colorSwatch.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
                };
                colorSwatch.onmouseleave = () => {
                    colorSwatch.style.transform = "scale(1)";
                    colorSwatch.style.boxShadow = "none";
                };
                const colorInfo = document.createElement("div");
                colorInfo.className = "colorInfo";
                const colorHex = document.createElement("div");
                colorHex.className = "colorHex";
                colorHex.textContent = hexColor.toUpperCase();
                const colorDesc = document.createElement("div");
                colorDesc.className = "colorDesc";
                colorDesc.textContent = colorDescriptions[hexColor] || `${gameElement.replace('_', ' ')}`;
                const elementProps = colorMapping_1.getElementProperties(gameElement);
                const colorProps = document.createElement("div");
                colorProps.className = "colorProps";
                // Add property indicators
                if (elementProps.walkable) {
                    colorProps.innerHTML += '<span class="prop walkable">Walkable</span>';
                }
                else {
                    colorProps.innerHTML += '<span class="prop blocked">Blocked</span>';
                }
                if (elementProps.dangerous) {
                    colorProps.innerHTML += '<span class="prop dangerous">Danger</span>';
                }
                if (elementProps.collectible) {
                    colorProps.innerHTML += '<span class="prop collectible">Collectible</span>';
                }
                if (elementProps.interactive) {
                    colorProps.innerHTML += '<span class="prop interactive">Interactive</span>';
                }
                colorInfo.appendChild(colorHex);
                colorInfo.appendChild(colorDesc);
                colorInfo.appendChild(colorProps);
                colorItem.appendChild(colorSwatch);
                colorItem.appendChild(colorInfo);
                colorGrid.appendChild(colorItem);
            });
            component.domElement.appendChild(colorGrid);
        }
        // Initialize with default mappings
        component.updateMappings();
        return component;
    }
    exports_18("createColorReference", createColorReference);
    return {
        setters: [
            function (colorMapping_1_1) {
                colorMapping_1 = colorMapping_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/imageEditor", ["util", "components/common", "components/colorReference"], function (exports_19, context_19) {
    "use strict";
    var util_5, common_4, colorReference_1;
    var __moduleName = context_19 && context_19.id;
    function createImageEditor() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "imageEditorComponent" }),
            loadImage: (imageData) => {
                canvas.width = imageData.width;
                canvas.height = imageData.height;
                ctx.putImageData(imageData, 0, 0);
                updateCanvasDisplay();
            },
            getImageData: () => {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                return imageData;
            },
            clear: () => {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };
        // Drawing state
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        let currentTool = 'pen';
        let currentColor = '#000000';
        let lineWidth = 2;
        let startX = 0;
        let startY = 0;
        let scaleFactor = 8; // Smaller scale for larger images
        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.className = "imageEditorCanvas";
        canvas.style.border = "1px solid #ccc";
        canvas.style.cursor = "crosshair";
        canvas.style.imageRendering = "pixelated";
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Tool selection
        const toolSelect = document.createElement("select");
        toolSelect.innerHTML = `
    <option value="pen">Pen</option>
    <option value="eraser">Eraser</option>
    <option value="bucket">Paint Bucket</option>
    <option value="rectangle">Rectangle</option>
    <option value="circle">Circle</option>
    <option value="line">Line</option>
    <option value="spray">Spray</option>
  `;
        toolSelect.value = currentTool;
        toolSelect.onchange = () => {
            currentTool = toolSelect.value;
            canvas.style.cursor = currentTool === 'eraser' ? 'not-allowed' :
                currentTool === 'bucket' ? 'pointer' : 'crosshair';
        };
        // Color picker
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = currentColor;
        colorInput.onchange = () => {
            currentColor = colorInput.value;
        };
        // Line width slider
        const widthLabel = document.createElement("label");
        widthLabel.textContent = "Size: ";
        const widthInput = document.createElement("input");
        widthInput.type = "range";
        widthInput.min = "1";
        widthInput.max = "20";
        widthInput.value = lineWidth.toString();
        widthInput.oninput = () => {
            lineWidth = parseInt(widthInput.value);
        };
        // Scale slider
        const scaleLabel = document.createElement("label");
        scaleLabel.textContent = "Zoom: ";
        const scaleInput = document.createElement("input");
        scaleInput.type = "range";
        scaleInput.min = "4";
        scaleInput.max = "32";
        scaleInput.value = scaleFactor.toString();
        scaleInput.oninput = () => {
            scaleFactor = parseInt(scaleInput.value);
            updateCanvasDisplay();
        };
        // Clear button
        const clearButton = document.createElement("input");
        clearButton.type = "button";
        clearButton.value = "Clear Canvas";
        clearButton.onclick = () => {
            component.clear();
        };
        // Use edited image button
        const useEditedButton = document.createElement("input");
        useEditedButton.type = "button";
        useEditedButton.value = "Use Edited Image";
        useEditedButton.onclick = () => {
            const imageData = component.getImageData();
            if (imageData && component.onEditComplete) {
                component.onEditComplete(imageData);
            }
        };
        // Color reference component
        const colorReference = colorReference_1.createColorReference();
        colorReference.onColorSelect = (selectedColor) => {
            currentColor = selectedColor;
            colorInput.value = selectedColor;
        };
        // Helper functions
        function updateCanvasDisplay() {
            canvas.style.width = `${canvas.width * scaleFactor}px`;
            canvas.style.height = `${canvas.height * scaleFactor}px`;
        }
        function getCanvasCoordinates(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
        // Drawing functions
        function startDrawing(e) {
            isDrawing = true;
            const coords = getCanvasCoordinates(e);
            [lastX, lastY] = [coords.x, coords.y];
            [startX, startY] = [coords.x, coords.y];
            if ((currentTool === 'pen' || currentTool === 'eraser') && lineWidth === 1) {
                // For pixel-perfect pen with size 1, draw immediately on click
                ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
                ctx.fillRect(Math.floor(coords.x), Math.floor(coords.y), 1, 1);
            }
            else if (currentTool === 'pen' || currentTool === 'eraser') {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
            }
            else if (currentTool === 'bucket') {
                // For bucket tool, fill immediately on click
                floodFill(Math.floor(coords.x), Math.floor(coords.y), currentColor);
                isDrawing = false;
            }
        }
        function draw(e) {
            if (!isDrawing)
                return;
            const coords = getCanvasCoordinates(e);
            const x = coords.x;
            const y = coords.y;
            ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
            switch (currentTool) {
                case 'pen':
                case 'eraser':
                    if (lineWidth === 1) {
                        // Pixel-perfect drawing for size 1 - only draw if moved to a different pixel
                        const currentPixelX = Math.floor(x);
                        const currentPixelY = Math.floor(y);
                        const lastPixelX = Math.floor(lastX);
                        const lastPixelY = Math.floor(lastY);
                        if (currentPixelX !== lastPixelX || currentPixelY !== lastPixelY) {
                            ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
                            ctx.fillRect(currentPixelX, currentPixelY, 1, 1);
                        }
                    }
                    else {
                        // Normal line drawing for larger sizes
                        ctx.lineWidth = lineWidth;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.lineTo(x, y);
                        ctx.stroke();
                    }
                    break;
                case 'spray':
                    sprayPaint(x, y);
                    break;
            }
            [lastX, lastY] = [x, y];
        }
        function stopDrawing(e) {
            if (!isDrawing)
                return;
            isDrawing = false;
            const coords = getCanvasCoordinates(e);
            const x = coords.x;
            const y = coords.y;
            switch (currentTool) {
                case 'rectangle':
                    drawRectangle(startX, startY, x, y);
                    break;
                case 'circle':
                    drawCircle(startX, startY, x, y);
                    break;
                case 'line':
                    drawLine(startX, startY, x, y);
                    break;
            }
        }
        function sprayPaint(x, y) {
            const density = 50;
            const radius = lineWidth * 2;
            for (let i = 0; i < density; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                const sprayX = x + Math.cos(angle) * distance;
                const sprayY = y + Math.sin(angle) * distance;
                ctx.fillStyle = currentColor;
                ctx.beginPath();
                ctx.arc(sprayX, sprayY, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        function drawRectangle(x1, y1, x2, y2) {
            const width = x2 - x1;
            const height = y2 - y1;
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.strokeRect(x1, y1, width, height);
        }
        function drawCircle(x1, y1, x2, y2) {
            const radius = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.arc(x1, y1, radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        function drawLine(x1, y1, x2, y2) {
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        function floodFill(startX, startY, fillColor) {
            // Get the image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            // Convert fill color to RGB
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = fillColor;
            tempCtx.fillRect(0, 0, 1, 1);
            const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
            const fillR = fillData[0];
            const fillG = fillData[1];
            const fillB = fillData[2];
            // Get the color we're replacing
            const startIndex = (startY * canvas.width + startX) * 4;
            const targetR = data[startIndex];
            const targetG = data[startIndex + 1];
            const targetB = data[startIndex + 2];
            // Don't fill if the target color is the same as fill color
            if (targetR === fillR && targetG === fillG && targetB === fillB) {
                return;
            }
            // Flood fill using stack-based approach
            const stack = [[startX, startY]];
            const visited = new Set();
            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const key = `${x},${y}`;
                if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
                    continue;
                }
                const index = (y * canvas.width + x) * 4;
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];
                // Check if this pixel matches the target color
                if (r === targetR && g === targetG && b === targetB) {
                    // Fill the pixel
                    data[index] = fillR;
                    data[index + 1] = fillG;
                    data[index + 2] = fillB;
                    data[index + 3] = 255; // Alpha
                    visited.add(key);
                    // Add adjacent pixels to stack
                    stack.push([x + 1, y]);
                    stack.push([x - 1, y]);
                    stack.push([x, y + 1]);
                    stack.push([x, y - 1]);
                }
            }
            // Put the modified image data back
            ctx.putImageData(imageData, 0, 0);
        }
        // Event listeners
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        // Create main container for two-column layout
        const mainContainer = document.createElement("div");
        mainContainer.className = "editorMainContainer";
        // Left column - Editor tools and canvas
        const leftColumn = document.createElement("div");
        leftColumn.className = "editorLeftColumn";
        // Right column - Color reference
        const rightColumn = document.createElement("div");
        rightColumn.className = "editorRightColumn";
        rightColumn.appendChild(colorReference.domElement);
        // Build left column content
        util_5.buildDomTree(leftColumn, [
            document.createElement("p"), [
                "Edit the generated image. Add player start/end points and polish the dungeon layout."
            ],
            common_4.inputGroup(), [
                document.createElement("label"), ["Tool: ", toolSelect],
                document.createElement("label"), ["Color: ", colorInput],
                widthLabel, widthInput,
                scaleLabel, scaleInput,
            ],
            common_4.inputGroup(), [
                clearButton,
                useEditedButton,
            ],
            canvas,
        ]);
        mainContainer.appendChild(leftColumn);
        mainContainer.appendChild(rightColumn);
        component.domElement.appendChild(mainContainer);
        return component;
    }
    exports_19("createImageEditor", createImageEditor);
    return {
        setters: [
            function (util_5_1) {
                util_5 = util_5_1;
            },
            function (common_4_1) {
                common_4 = common_4_1;
            },
            function (colorReference_1_1) {
                colorReference_1 = colorReference_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/threeJSDungeonCrawler", ["colorMapping"], function (exports_20, context_20) {
    "use strict";
    var colorMapping_2;
    var __moduleName = context_20 && context_20.id;
    function createThreeJSDungeonCrawler() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "threeJSDungeonCrawlerComponent" }),
            startGame: async (gameMap, playerStart) => {
                await initializeGame(gameMap, playerStart);
            },
            stopGame: () => {
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
                if (renderer && component.domElement.contains(renderer.domElement)) {
                    component.domElement.removeChild(renderer.domElement);
                }
            }
        };
        // Three.js components
        let scene;
        let camera;
        let renderer;
        let animationId;
        // Game state
        let currentGameMap = [];
        let enemies = [];
        let gameRunning = false;
        // Player state
        const player = {
            x: 0,
            y: 0,
            angle: 0,
            health: 100,
            maxHealth: 100,
            keys: 0,
            treasures: 0
        };
        // Game constants
        const BASE_WIDTH = 480;
        const BASE_HEIGHT = 320;
        const SCALE_FACTOR = 2; // Upscale to 960x640
        const WALL_HEIGHT = 2.0;
        const MOVE_SPEED = 0.05;
        const ROTATE_SPEED = 0.03;
        // Input state
        const keysPressed = new Set();
        async function initializeGame(gameMap, playerStart) {
            currentGameMap = gameMap;
            player.x = playerStart.x + 0.5;
            player.y = playerStart.y + 0.5;
            player.angle = 0;
            player.health = player.maxHealth;
            player.keys = 0;
            player.treasures = 0;
            enemies = [];
            gameRunning = true;
            // Check if Three.js is available
            if (typeof THREE === 'undefined') {
                console.error('Three.js is not loaded. Make sure the CDN script is working.');
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = 'color: red; font-size: 18px; text-align: center; margin: 20px; padding: 20px; border: 2px solid red; border-radius: 10px; background: #ffe6e6;';
                errorMsg.innerHTML = `
        ❌ <strong>Three.js failed to load!</strong><br>
        Please check your internet connection and refresh the page.<br>
        <br>
        <small>If the problem persists, try:</small><br>
        <code>npm run dev</code> to restart the server
      `;
                component.domElement.appendChild(errorMsg);
                return;
            }
            // THREE is already declared globally
            // Initialize Three.js scene
            await setupThreeJS();
            // Create the dungeon geometry
            createDungeon();
            // Start the game loop
            gameLoop();
        }
        async function setupThreeJS() {
            // Create scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x1a1a2a); // Dark blue background
            // Create camera
            camera = new THREE.PerspectiveCamera(75, BASE_WIDTH / BASE_HEIGHT, 0.1, 1000);
            camera.position.set(player.x, 1, player.y);
            camera.lookAt(player.x + Math.cos(player.angle), 1, player.y + Math.sin(player.angle));
            // Create renderer with upscaling
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(BASE_WIDTH * SCALE_FACTOR, BASE_HEIGHT * SCALE_FACTOR);
            renderer.domElement.style.width = `${BASE_WIDTH * SCALE_FACTOR}px`;
            renderer.domElement.style.height = `${BASE_HEIGHT * SCALE_FACTOR}px`;
            renderer.domElement.style.imageRendering = 'pixelated';
            renderer.setPixelRatio(window.devicePixelRatio);
            // Add lighting
            const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            scene.add(directionalLight);
            // Add renderer to DOM
            component.domElement.appendChild(renderer.domElement);
        }
        function createDungeon() {
            const mapWidth = currentGameMap[0].length;
            const mapHeight = currentGameMap.length;
            // Create floor
            createFloor(mapWidth, mapHeight);
            // Create walls
            createWalls(mapWidth, mapHeight);
            // Create sprites for interactive elements
            createSprites();
        }
        function createFloor(width, height) {
            // Create floor geometry
            const floorGeometry = new THREE.PlaneGeometry(width, height);
            const floorMaterial = new THREE.MeshLambertMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.9
            });
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
            scene.add(floor);
            // Add floor texture pattern
            createFloorTexture(width, height);
        }
        function createFloorTexture(width, height) {
            const tileSize = 1;
            const tilesX = Math.floor(width / tileSize);
            const tilesY = Math.floor(height / tileSize);
            for (let x = 0; x < tilesX; x++) {
                for (let y = 0; y < tilesY; y++) {
                    const color = (x + y) % 2 === 0 ? 0x555555 : 0x333333;
                    const tileGeometry = new THREE.PlaneGeometry(tileSize * 0.95, tileSize * 0.95);
                    const tileMaterial = new THREE.MeshLambertMaterial({ color });
                    const tile = new THREE.Mesh(tileGeometry, tileMaterial);
                    tile.rotation.x = -Math.PI / 2;
                    tile.position.set(x * tileSize, 0.01, y * tileSize);
                    scene.add(tile);
                }
            }
        }
        function createWalls(width, height) {
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const element = currentGameMap[y][x];
                    const properties = colorMapping_2.getElementProperties(element);
                    if (!properties.walkable) {
                        createWall(x, y, element);
                    }
                }
            }
        }
        function createWall(x, y, element) {
            const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
            const wallMaterial = new THREE.MeshLambertMaterial({
                color: getWallColor(element),
                transparent: false
            });
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(x, WALL_HEIGHT / 2, y);
            scene.add(wall);
        }
        function getWallColor(element) {
            switch (element) {
                case colorMapping_2.GameElement.WALL:
                    return 0x666666; // Stone gray
                case colorMapping_2.GameElement.DOOR:
                    return 0x8B4513; // Brown wood
                case colorMapping_2.GameElement.DANGER:
                    return 0x8B0000; // Dark red
                case colorMapping_2.GameElement.FIRE:
                    return 0xFF4500; // Orange red
                default:
                    return 0x555555;
            }
        }
        function createSprites() {
            for (let y = 0; y < currentGameMap.length; y++) {
                for (let x = 0; x < currentGameMap[y].length; x++) {
                    const element = currentGameMap[y][x];
                    const properties = colorMapping_2.getElementProperties(element);
                    if (properties.interactive || element === colorMapping_2.GameElement.ENEMY) {
                        createSprite(x, y, element);
                    }
                }
            }
        }
        function createSprite(x, y, element) {
            // Create a canvas for the sprite texture
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            // Draw simple colored square based on element type
            ctx.fillStyle = getSpriteColor(element);
            ctx.fillRect(0, 0, 32, 32);
            // Add border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, 30, 30);
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            // Create sprite material
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true
            });
            // Create sprite
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, 1, y);
            sprite.scale.set(0.8, 0.8, 0.8);
            scene.add(sprite);
        }
        function getSpriteColor(element) {
            switch (element) {
                case colorMapping_2.GameElement.ENEMY:
                    return '#ff0000'; // Red
                case colorMapping_2.GameElement.DANGER:
                    return '#ff6600'; // Orange
                case colorMapping_2.GameElement.PLAYER_FINISH:
                    return '#00ff00'; // Green
                case colorMapping_2.GameElement.TREASURE:
                    return '#ffff00'; // Yellow
                case colorMapping_2.GameElement.KEY:
                    return '#ffd700'; // Gold
                case colorMapping_2.GameElement.DOOR:
                    return '#8B4513'; // Brown
                case colorMapping_2.GameElement.STAIRS:
                    return '#c0c0c0'; // Silver
                default:
                    return '#888888';
            }
        }
        function updatePlayer() {
            let newX = player.x;
            let newY = player.y;
            // Handle movement
            if (keysPressed.has('keyw') || keysPressed.has('arrowup')) {
                newX += Math.cos(player.angle) * MOVE_SPEED;
                newY += Math.sin(player.angle) * MOVE_SPEED;
            }
            if (keysPressed.has('keys') || keysPressed.has('arrowdown')) {
                newX -= Math.cos(player.angle) * MOVE_SPEED;
                newY -= Math.sin(player.angle) * MOVE_SPEED;
            }
            if (keysPressed.has('keya') || keysPressed.has('arrowleft')) {
                newX += Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
                newY += Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
            }
            if (keysPressed.has('keyd') || keysPressed.has('arrowright')) {
                newX -= Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
                newY -= Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
            }
            // Handle rotation
            if (keysPressed.has('keyq')) {
                player.angle -= ROTATE_SPEED;
            }
            if (keysPressed.has('keye')) {
                player.angle += ROTATE_SPEED;
            }
            // Check collision and update position
            if (isValidPosition(newX, newY)) {
                player.x = newX;
                player.y = newY;
            }
            // Update camera position
            camera.position.set(player.x, 1, player.y);
            const lookX = player.x + Math.cos(player.angle) * 2;
            const lookZ = player.y + Math.sin(player.angle) * 2;
            camera.lookAt(lookX, 1, lookZ);
        }
        function isValidPosition(x, y) {
            const tileX = Math.floor(x);
            const tileY = Math.floor(y);
            if (tileX < 0 || tileX >= currentGameMap[0].length ||
                tileY < 0 || tileY >= currentGameMap.length) {
                return false;
            }
            const element = currentGameMap[tileY][tileX];
            const properties = colorMapping_2.getElementProperties(element);
            return properties.walkable;
        }
        function gameLoop() {
            if (!gameRunning)
                return;
            updatePlayer();
            renderer.render(scene, camera);
            animationId = requestAnimationFrame(gameLoop);
        }
        // Input handling
        function handleKeyDown(e) {
            keysPressed.add(e.code.toLowerCase());
        }
        function handleKeyUp(e) {
            keysPressed.delete(e.code.toLowerCase());
        }
        // Event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return component;
    }
    exports_20("createThreeJSDungeonCrawler", createThreeJSDungeonCrawler);
    return {
        setters: [
            function (colorMapping_2_1) {
                colorMapping_2 = colorMapping_2_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("main", ["wfc/run", "util", "components/wfcOptions", "components/presetPicker", "components/drawingCanvas", "components/imageEditor", "components/threeJSDungeonCrawler", "colorMapping"], function (exports_21, context_21) {
    "use strict";
    var run_1, util_6, wfcOptions_1, presetPicker_1, drawingCanvas_1, imageEditor_1, threeJSDungeonCrawler_1, colorMapping_3, wfc, AppMode, currentMode, generatedImageData, gameMap, canvas, wfcOptions, inputBitmap, downloadButton, editImageButton, startWFC, modeTabContainer, inputModeTab, wfcModeTab, editModeTab, gameModeTab, contentContainer, inputTabContainer, presetTab, drawTab, inputContainer, presetPicker, drawingCanvas, imageEditor, dungeonCrawler, mainElem;
    var __moduleName = context_21 && context_21.id;
    // Tab switching logic for input tabs
    function switchInputTab(activeTab, inactiveTab, showElement) {
        activeTab.classList.add("active");
        inactiveTab.classList.remove("active");
        // Clear and add the correct input method
        inputContainer.innerHTML = "";
        inputContainer.appendChild(showElement);
    }
    // Mode switching logic
    function switchMode(newMode) {
        // Remove active class from all mode tabs
        inputModeTab.classList.remove("active");
        wfcModeTab.classList.remove("active");
        editModeTab.classList.remove("active");
        gameModeTab.classList.remove("active");
        // Clear content container
        contentContainer.innerHTML = "";
        currentMode = newMode;
        switch (newMode) {
            case AppMode.INPUT:
                inputModeTab.classList.add("active");
                buildInputMode();
                break;
            case AppMode.WFC_GENERATION:
                wfcModeTab.classList.add("active");
                buildWFCGenerationMode();
                break;
            case AppMode.IMAGE_EDITING:
                editModeTab.classList.add("active");
                buildImageEditingMode();
                break;
            case AppMode.DUNGEON_CRAWLER:
                gameModeTab.classList.add("active");
                buildDungeonCrawlerMode();
                break;
        }
    }
    function buildInputMode() {
        util_6.buildDomTree(contentContainer, [
            document.createElement("h2"), ["Input bitmap"],
            inputTabContainer, [
                presetTab,
                drawTab,
            ],
            inputContainer,
            document.createElement("h2"), ["Options"],
            wfcOptions.domElement,
        ]);
        // Initialize with preset picker
        inputContainer.appendChild(presetPicker.domElement);
    }
    function buildWFCGenerationMode() {
        const restartWfc = document.createElement("input");
        restartWfc.type = "button";
        restartWfc.value = "Restart Generation";
        restartWfc.onclick = startWFC;
        downloadButton = document.createElement("input");
        downloadButton.type = "button";
        downloadButton.value = "Download PNG";
        downloadButton.disabled = true;
        downloadButton.onclick = () => {
            // Create a link element to trigger download
            const link = document.createElement("a");
            link.download = `wfc-output-${Date.now()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        };
        editImageButton = document.createElement("input");
        editImageButton.type = "button";
        editImageButton.value = "Edit Generated Image";
        editImageButton.disabled = true;
        editImageButton.onclick = () => {
            switchMode(AppMode.IMAGE_EDITING);
        };
        util_6.buildDomTree(contentContainer, [
            document.createElement("h2"), ["Wave Function Collapse Generation"],
            document.createElement("div"), [
                restartWfc,
                downloadButton,
                editImageButton,
            ],
            canvas,
        ]);
    }
    function buildImageEditingMode() {
        if (generatedImageData) {
            imageEditor.loadImage(generatedImageData);
        }
        util_6.buildDomTree(contentContainer, [
            document.createElement("h2"), ["Edit Generated Image"],
            document.createElement("p"), [
                "Use the drawing tools to add player start (dark green) and finish (dark red) points, polish routes, and adjust the dungeon layout."
            ],
            imageEditor.domElement,
        ]);
    }
    function buildDungeonCrawlerMode() {
        util_6.buildDomTree(contentContainer, [
            document.createElement("h2"), ["Dungeon Crawler Game"],
            dungeonCrawler.domElement,
        ]);
    }
    async function startDungeonCrawler() {
        if (!generatedImageData)
            return;
        // Convert image to game map
        gameMap = colorMapping_3.imageDataToGameMap(generatedImageData);
        // Find player start position
        const playerStart = colorMapping_3.findPlayerStart(gameMap);
        if (!playerStart) {
            alert("No player start position found! Please add a dark green (#006400) pixel to mark the start.");
            switchMode(AppMode.IMAGE_EDITING);
            return;
        }
        // Find player finish position
        const playerFinish = colorMapping_3.findPlayerFinish(gameMap);
        if (!playerFinish) {
            alert("No player finish position found! Please add a dark red (#8B0000) pixel to mark the finish.");
            switchMode(AppMode.IMAGE_EDITING);
            return;
        }
        // Start the game
        try {
            await dungeonCrawler.startGame(gameMap, playerStart);
        }
        catch (error) {
            console.error('Failed to start game:', error);
        }
    }
    return {
        setters: [
            function (run_1_1) {
                run_1 = run_1_1;
            },
            function (util_6_1) {
                util_6 = util_6_1;
            },
            function (wfcOptions_1_1) {
                wfcOptions_1 = wfcOptions_1_1;
            },
            function (presetPicker_1_1) {
                presetPicker_1 = presetPicker_1_1;
            },
            function (drawingCanvas_1_1) {
                drawingCanvas_1 = drawingCanvas_1_1;
            },
            function (imageEditor_1_1) {
                imageEditor_1 = imageEditor_1_1;
            },
            function (threeJSDungeonCrawler_1_1) {
                threeJSDungeonCrawler_1 = threeJSDungeonCrawler_1_1;
            },
            function (colorMapping_3_1) {
                colorMapping_3 = colorMapping_3_1;
            }
        ],
        execute: function () {
            // Current application state
            (function (AppMode) {
                AppMode["INPUT"] = "input";
                AppMode["WFC_GENERATION"] = "wfc_generation";
                AppMode["IMAGE_EDITING"] = "image_editing";
                AppMode["DUNGEON_CRAWLER"] = "dungeon_crawler";
            })(AppMode || (AppMode = {}));
            currentMode = AppMode.INPUT;
            gameMap = [];
            canvas = document.createElement("canvas");
            canvas.className = "wfcOutput";
            canvas.width = 0;
            canvas.height = 0;
            wfcOptions = wfcOptions_1.createWfcOptions();
            startWFC = () => {
                if (wfc) {
                    wfc.stop();
                }
                if (!inputBitmap) {
                    return;
                }
                // Disable download button while generating
                if (downloadButton)
                    downloadButton.disabled = true;
                if (editImageButton)
                    editImageButton.disabled = true;
                wfc = run_1.createWaveFunctionCollapse(inputBitmap, canvas, wfcOptions.options, () => {
                    // Enable buttons when generation completes
                    if (downloadButton)
                        downloadButton.disabled = false;
                    if (editImageButton)
                        editImageButton.disabled = false;
                    // Get the generated image data
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        generatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    }
                });
            };
            // Create mode tabs
            modeTabContainer = document.createElement("div");
            modeTabContainer.className = "modeTabContainer";
            inputModeTab = document.createElement("button");
            inputModeTab.textContent = "1. Create Input";
            inputModeTab.className = "modeTab active";
            wfcModeTab = document.createElement("button");
            wfcModeTab.textContent = "2. Generate";
            wfcModeTab.className = "modeTab";
            editModeTab = document.createElement("button");
            editModeTab.textContent = "3. Edit Image";
            editModeTab.className = "modeTab";
            gameModeTab = document.createElement("button");
            gameModeTab.textContent = "4. Play Game";
            gameModeTab.className = "modeTab";
            contentContainer = document.createElement("div");
            contentContainer.className = "contentContainer";
            // Input mode content
            inputTabContainer = document.createElement("div");
            inputTabContainer.className = "tabContainer";
            presetTab = document.createElement("button");
            presetTab.textContent = "Preset Images";
            presetTab.className = "tab active";
            drawTab = document.createElement("button");
            drawTab.textContent = "Draw Custom";
            drawTab.className = "tab";
            inputContainer = document.createElement("div");
            inputContainer.className = "inputContainer";
            // Preset picker
            presetPicker = presetPicker_1.createPresetPicker();
            presetPicker.onPick = (image, options) => {
                inputBitmap = image;
                wfcOptions.updateOptions(options);
                switchMode(AppMode.WFC_GENERATION);
                startWFC();
            };
            // Drawing canvas
            drawingCanvas = drawingCanvas_1.createDrawingCanvas();
            drawingCanvas.onDrawComplete = (image) => {
                inputBitmap = image;
                wfcOptions.updateOptions({}); // Reset to defaults for custom drawings
                switchMode(AppMode.WFC_GENERATION);
                startWFC();
            };
            // Image editor
            imageEditor = imageEditor_1.createImageEditor();
            imageEditor.onEditComplete = (image) => {
                generatedImageData = image;
                switchMode(AppMode.DUNGEON_CRAWLER);
                startDungeonCrawler();
            };
            // Three.js Dungeon crawler
            dungeonCrawler = threeJSDungeonCrawler_1.createThreeJSDungeonCrawler();
            dungeonCrawler.onGameComplete = () => {
                alert("Congratulations! You completed the dungeon!");
                switchMode(AppMode.INPUT);
            };
            dungeonCrawler.onGameOver = () => {
                alert("Game Over! You died in the dungeon.");
                switchMode(AppMode.INPUT);
            };
            presetTab.onclick = () => switchInputTab(presetTab, drawTab, presetPicker.domElement);
            drawTab.onclick = () => switchInputTab(drawTab, presetTab, drawingCanvas.domElement);
            // Mode tab event listeners
            inputModeTab.onclick = () => switchMode(AppMode.INPUT);
            wfcModeTab.onclick = () => switchMode(AppMode.WFC_GENERATION);
            editModeTab.onclick = () => switchMode(AppMode.IMAGE_EDITING);
            gameModeTab.onclick = () => switchMode(AppMode.DUNGEON_CRAWLER);
            // Initialize the application
            mainElem = document.querySelector("main");
            if (mainElem) {
                const content = util_6.buildDomTree(mainElem, [
                    document.createElement("h2"), ["Wave Function Collapse Dungeon Generator"],
                    modeTabContainer, [
                        inputModeTab,
                        wfcModeTab,
                        editModeTab,
                        gameModeTab,
                    ],
                    contentContainer,
                ]);
                mainElem.appendChild(content);
                // Start with input mode
                switchMode(AppMode.INPUT);
            }
        }
    };
});
