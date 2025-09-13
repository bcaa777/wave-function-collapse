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
System.register("main", ["wfc/run", "util", "components/wfcOptions", "components/presetPicker", "components/drawingCanvas"], function (exports_17, context_17) {
    "use strict";
    var run_1, util_5, wfcOptions_1, presetPicker_1, drawingCanvas_1, wfc, canvas, wfcOptions, inputBitmap, start, tabContainer, presetTab, drawTab, inputContainer, presetPicker, drawingCanvas, restartWfc, downloadButton, mainElem;
    var __moduleName = context_17 && context_17.id;
    // Tab switching logic
    function switchTab(activeTab, inactiveTab, showElement) {
        activeTab.classList.add("active");
        inactiveTab.classList.remove("active");
        // Clear and add the correct input method
        inputContainer.innerHTML = "";
        inputContainer.appendChild(showElement);
    }
    return {
        setters: [
            function (run_1_1) {
                run_1 = run_1_1;
            },
            function (util_5_1) {
                util_5 = util_5_1;
            },
            function (wfcOptions_1_1) {
                wfcOptions_1 = wfcOptions_1_1;
            },
            function (presetPicker_1_1) {
                presetPicker_1 = presetPicker_1_1;
            },
            function (drawingCanvas_1_1) {
                drawingCanvas_1 = drawingCanvas_1_1;
            }
        ],
        execute: function () {
            canvas = document.createElement("canvas");
            canvas.className = "wfcOutput";
            canvas.width = 0;
            canvas.height = 0;
            wfcOptions = wfcOptions_1.createWfcOptions();
            start = () => {
                if (wfc) {
                    wfc.stop();
                }
                if (!inputBitmap) {
                    return;
                }
                // Disable download button while generating
                downloadButton.disabled = true;
                wfc = run_1.createWaveFunctionCollapse(inputBitmap, canvas, wfcOptions.options, () => {
                    // Enable download button when generation completes
                    downloadButton.disabled = false;
                });
            };
            // Create input method tabs
            tabContainer = document.createElement("div");
            tabContainer.className = "tabContainer";
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
                start();
            };
            // Drawing canvas
            drawingCanvas = drawingCanvas_1.createDrawingCanvas();
            drawingCanvas.onDrawComplete = (image) => {
                inputBitmap = image;
                wfcOptions.updateOptions({}); // Reset to defaults for custom drawings
                start();
            };
            presetTab.onclick = () => switchTab(presetTab, drawTab, presetPicker.domElement);
            drawTab.onclick = () => switchTab(drawTab, presetTab, drawingCanvas.domElement);
            // Initialize with preset picker
            inputContainer.appendChild(presetPicker.domElement);
            restartWfc = document.createElement("input");
            restartWfc.type = "button";
            restartWfc.value = "Restart Generation";
            restartWfc.onclick = start;
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
            mainElem = document.querySelector("main");
            if (mainElem) {
                const content = util_5.buildDomTree(mainElem, [
                    document.createElement("h2"), ["Input bitmap"],
                    tabContainer, [
                        presetTab,
                        drawTab,
                    ],
                    inputContainer,
                    document.createElement("h2"), ["Options"],
                    wfcOptions.domElement,
                    document.createElement("h2"), ["Output"],
                    document.createElement("div"), [
                        restartWfc,
                        downloadButton,
                    ],
                    canvas,
                ]);
                mainElem.appendChild(content);
            }
        }
    };
});
