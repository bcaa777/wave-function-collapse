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
                if (child instanceof Node) {
                    // Prevent HierarchyRequestError: do not append a node into one of its ancestors
                    if (child.contains(parent)) {
                        console.error('buildDomTree: Refusing to append a node into one of its ancestors. Skipping.');
                        continue;
                    }
                    parent.appendChild(child);
                }
                else {
                    parent.appendChild(document.createTextNode(child.toString()));
                }
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
        domElement.className = "wfcInputComponent card";
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
                document.createElement("div"), [
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
                document.createElement("div"), [
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
System.register("gameSettings", [], function (exports_13, context_13) {
    "use strict";
    var settings, listeners;
    var __moduleName = context_13 && context_13.id;
    function getSettings() {
        return settings;
    }
    exports_13("getSettings", getSettings);
    function setSetting(key, value) {
        settings[key] = value;
        listeners.forEach(l => l(key, value));
    }
    exports_13("setSetting", setSetting);
    function onSettingsChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
    exports_13("onSettingsChange", onSettingsChange);
    function setSpriteOverride(name, url) {
        settings.spriteOverrides.set(name, url);
        listeners.forEach(l => l('spriteOverrides', settings.spriteOverrides));
    }
    exports_13("setSpriteOverride", setSpriteOverride);
    function setTextureOverride(name, url) {
        settings.textureOverrides.set(name, url);
        listeners.forEach(l => l('textureOverrides', settings.textureOverrides));
    }
    exports_13("setTextureOverride", setTextureOverride);
    return {
        setters: [],
        execute: function () {
            settings = {
                playerLightIntensity: 5.0,
                postProcessingEnabled: false,
                paletteMode: 0,
                useProceduralSprites: true,
                spriteOverrides: new Map(),
                textureOverrides: new Map(),
                heightMode: 'quantized',
                heightScaleMeters: 6.0,
                heightLevels: 6,
                heightBaseMeters: 0.0,
                heightSmoothingPasses: 2,
                heightBlurRadius: 1,
                heightBlurType: 'gaussian',
                heightNoiseFrequency: 1.2,
                heightNoiseOctaves: 4,
                heightSeed: 1337,
                heightMaxSlopePerTile: 0.25,
                heightRelaxPasses: 1,
                heightMeshSubdivision: 2
            };
            listeners = new Set();
        }
    };
});
System.register("components/settingsPanel", ["gameSettings"], function (exports_14, context_14) {
    "use strict";
    var gameSettings_1;
    var __moduleName = context_14 && context_14.id;
    function createSettingsPanel() {
        const el = Object.assign(document.createElement('div'), { className: 'settingsPanel' });
        const component = { domElement: el };
        const s = gameSettings_1.getSettings();
        const lightInput = document.createElement('input');
        lightInput.type = 'range';
        lightInput.min = '0';
        lightInput.max = '10';
        lightInput.step = '0.1';
        lightInput.value = String(s.playerLightIntensity);
        lightInput.oninput = () => gameSettings_1.setSetting('playerLightIntensity', parseFloat(lightInput.value));
        const postToggle = document.createElement('input');
        postToggle.type = 'checkbox';
        postToggle.checked = s.postProcessingEnabled;
        postToggle.onchange = () => gameSettings_1.setSetting('postProcessingEnabled', postToggle.checked);
        const paletteSelect = document.createElement('select');
        ['None', 'GameBoy', 'CRT', 'Retro16'].forEach((label, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.text = label;
            paletteSelect.appendChild(opt);
        });
        paletteSelect.value = String(s.paletteMode);
        paletteSelect.onchange = () => gameSettings_1.setSetting('paletteMode', parseInt(paletteSelect.value, 10));
        // Asset overrides moved to dedicated Assets page; keep settings panel minimal
        const row = document.createElement('div');
        row.className = 'row g-2';
        const col = (child, label) => {
            const c = document.createElement('div');
            c.className = 'col-auto d-flex align-items-center gap-2';
            const l = document.createElement('span');
            l.className = 'text-secondary small';
            l.textContent = label;
            c.appendChild(l);
            c.appendChild(child);
            return c;
        };
        row.appendChild(col(lightInput, 'Player Light'));
        row.appendChild(col(postToggle, 'Post FX'));
        row.appendChild(col(paletteSelect, 'Palette'));
        // Height controls
        const modeSel = document.createElement('select');
        ['lightness', 'quantized', 'heightmap', 'procedural'].forEach((m) => { const o = document.createElement('option'); o.value = m; o.text = m; modeSel.appendChild(o); });
        modeSel.value = s.heightMode || 'quantized';
        modeSel.onchange = () => gameSettings_1.setSetting('heightMode', modeSel.value);
        row.appendChild(col(modeSel, 'Height Mode'));
        const scaleInput = document.createElement('input');
        scaleInput.type = 'range';
        scaleInput.min = '1';
        scaleInput.max = '50';
        scaleInput.step = '1';
        scaleInput.value = String(s.heightScaleMeters ?? 6);
        scaleInput.oninput = () => gameSettings_1.setSetting('heightScaleMeters', parseFloat(scaleInput.value));
        row.appendChild(col(scaleInput, 'Height Scale (m)'));
        const levelsInput = document.createElement('input');
        levelsInput.type = 'range';
        levelsInput.min = '2';
        levelsInput.max = '20';
        levelsInput.step = '1';
        levelsInput.value = String(s.heightLevels ?? 6);
        levelsInput.oninput = () => gameSettings_1.setSetting('heightLevels', parseInt(levelsInput.value, 10));
        row.appendChild(col(levelsInput, 'Levels'));
        const baseInput = document.createElement('input');
        baseInput.type = 'number';
        baseInput.step = '0.5';
        baseInput.value = String(s.heightBaseMeters ?? 0);
        baseInput.oninput = () => gameSettings_1.setSetting('heightBaseMeters', parseFloat(baseInput.value));
        row.appendChild(col(baseInput, 'Base (m)'));
        // Procedural params
        const smoothInput = document.createElement('input');
        smoothInput.type = 'range';
        smoothInput.min = '0';
        smoothInput.max = '5';
        smoothInput.step = '1';
        smoothInput.value = String(s.heightSmoothingPasses ?? 2);
        smoothInput.oninput = () => gameSettings_1.setSetting('heightSmoothingPasses', parseInt(smoothInput.value, 10));
        row.appendChild(col(smoothInput, 'Smooth Passes'));
        const blurInput = document.createElement('input');
        blurInput.type = 'range';
        blurInput.min = '0';
        blurInput.max = '3';
        blurInput.step = '1';
        blurInput.value = String(s.heightBlurRadius ?? 1);
        blurInput.oninput = () => gameSettings_1.setSetting('heightBlurRadius', parseInt(blurInput.value, 10));
        row.appendChild(col(blurInput, 'Blur Radius'));
        const blurType = document.createElement('select');
        ;
        ['box', 'gaussian'].forEach((m) => { const o = document.createElement('option'); o.value = m; o.text = m; blurType.appendChild(o); });
        blurType.value = s.heightBlurType ?? 'gaussian';
        blurType.onchange = () => gameSettings_1.setSetting('heightBlurType', blurType.value);
        row.appendChild(col(blurType, 'Blur Type'));
        const freqInput = document.createElement('input');
        freqInput.type = 'range';
        freqInput.min = '0.5';
        freqInput.max = '6';
        freqInput.step = '0.1';
        freqInput.value = String(s.heightNoiseFrequency ?? 1.2);
        freqInput.oninput = () => gameSettings_1.setSetting('heightNoiseFrequency', parseFloat(freqInput.value));
        row.appendChild(col(freqInput, 'Noise Freq'));
        const octInput = document.createElement('input');
        octInput.type = 'range';
        octInput.min = '1';
        octInput.max = '6';
        octInput.step = '1';
        octInput.value = String(s.heightNoiseOctaves ?? 4);
        octInput.oninput = () => gameSettings_1.setSetting('heightNoiseOctaves', parseInt(octInput.value, 10));
        row.appendChild(col(octInput, 'Octaves'));
        const seedInput = document.createElement('input');
        seedInput.type = 'number';
        seedInput.step = '1';
        seedInput.value = String(s.heightSeed ?? 1337);
        seedInput.oninput = () => gameSettings_1.setSetting('heightSeed', parseInt(seedInput.value, 10));
        row.appendChild(col(seedInput, 'Seed'));
        const slopeInput = document.createElement('input');
        slopeInput.type = 'range';
        slopeInput.min = '0.05';
        slopeInput.max = '1.0';
        slopeInput.step = '0.05';
        slopeInput.value = String(s.heightMaxSlopePerTile ?? 0.25);
        slopeInput.oninput = () => gameSettings_1.setSetting('heightMaxSlopePerTile', parseFloat(slopeInput.value));
        row.appendChild(col(slopeInput, 'Max Slope m/tile'));
        const relaxInput = document.createElement('input');
        relaxInput.type = 'range';
        relaxInput.min = '0';
        relaxInput.max = '4';
        relaxInput.step = '1';
        relaxInput.value = String(s.heightRelaxPasses ?? 1);
        relaxInput.oninput = () => gameSettings_1.setSetting('heightRelaxPasses', parseInt(relaxInput.value, 10));
        row.appendChild(col(relaxInput, 'Relax Passes'));
        const subdivInput = document.createElement('input');
        subdivInput.type = 'range';
        subdivInput.min = '1';
        subdivInput.max = '4';
        subdivInput.step = '1';
        subdivInput.value = String(s.heightMeshSubdivision ?? 2);
        subdivInput.oninput = () => gameSettings_1.setSetting('heightMeshSubdivision', parseInt(subdivInput.value, 10));
        row.appendChild(col(subdivInput, 'Mesh Subdiv'));
        // Overrides available on the Assets page
        el.appendChild(row);
        return component;
    }
    exports_14("createSettingsPanel", createSettingsPanel);
    return {
        setters: [
            function (gameSettings_1_1) {
                gameSettings_1 = gameSettings_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("getImageData", [], function (exports_15, context_15) {
    "use strict";
    var __moduleName = context_15 && context_15.id;
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
    exports_15("default", getImageData);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("presets", [], function (exports_16, context_16) {
    "use strict";
    var presetDefaults, presets;
    var __moduleName = context_16 && context_16.id;
    function getPresetPath(name) {
        return `images/${name}.png`;
    }
    exports_16("getPresetPath", getPresetPath);
    return {
        setters: [],
        execute: function () {
            exports_16("presetDefaults", presetDefaults = {
                name: "",
                N: 3,
                symmetry: 8,
                ground: 0,
                periodicInput: true,
                periodicOutput: true,
                outputWidth: 48,
                outputHeight: 48,
            });
            exports_16("presets", presets = [
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
System.register("components/presetPicker", ["getImageData", "util", "components/inputs", "components/common", "presets"], function (exports_17, context_17) {
    "use strict";
    var getImageData_1, util_3, inputs_2, common_2, presets_1;
    var __moduleName = context_17 && context_17.id;
    function createPresetPicker() {
        const presetPicker = {
            domElement: Object.assign(document.createElement("div"), { className: "presetPickerComponent card" }),
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
        // HSL demo presets (programmatic)
        const hslDemoChoices = [
            { label: "HSL: Terraces + Stairs", value: "terraces" },
            { label: "HSL: Biomes + Heights", value: "biomes" },
            { label: "HSL: Ramp 0-100m", value: "ramp" },
        ];
        const hslSelect = inputs_2.createSelectInput("HSL Demo", hslDemoChoices);
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
        hslSelect.onInput = (kind) => {
            imageInput.value = "";
            const image = generateHslDemo(kind);
            onPick(image, {});
            previewImage.style.display = "none";
        };
        util_3.buildDomTree(presetPicker.domElement, [
            document.createElement("p"), [
                "Select a preset or upload a custom image. Custom images should be simple - e.g. less than 64x64 pixels, with only a handful of colors.",
            ],
            common_2.inputGroup(), [
                presetSelect.domElement,
            ],
            common_2.inputGroup(), [
                hslSelect.domElement,
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
    exports_17("createPresetPicker", createPresetPicker);
    function generateHslDemo(kind) {
        const w = 48, h = 48;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        function put(x, y, r, g, b) {
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, 1, 1);
        }
        // Helper fixed colors for start/finish and stairs
        const START = [0x00, 0x64, 0x00]; // #006400
        const FINISH = [0x8B, 0x00, 0x00]; // #8B0000
        const STAIRS = [0xC0, 0xC0, 0xC0]; // #C0C0C0
        const WALL = [0x00, 0x00, 0x00]; // #000000
        if (kind === 'ramp') {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const l = Math.round((x / (w - 1)) * 255); // 0..255
                    // Use green hue for walkable floor, lightness encodes height
                    put(x, y, l * 0.2, Math.min(255, l + 40), l * 0.2);
                }
            }
            // start and finish
            put(2, Math.floor(h / 2), START[0], START[1], START[2]);
            put(w - 3, Math.floor(h / 2), FINISH[0], FINISH[1], FINISH[2]);
            return (ctx.getImageData(0, 0, w, h));
        }
        if (kind === 'biomes') {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const band = Math.floor((y / h) * 4);
                    const l = Math.round((x / (w - 1)) * 200 + 30);
                    if (band === 0) { // water band (blue)
                        put(x, y, 40, 80, Math.min(255, l));
                    }
                    else if (band === 1) { // grass band (green)
                        put(x, y, 30, Math.min(255, l), 30);
                    }
                    else if (band === 2) { // danger band (red)
                        put(x, y, Math.min(255, l), 30, 30);
                    }
                    else { // fire band (orange)
                        put(x, y, Math.min(255, l), Math.round(l * 0.6), 20);
                    }
                }
            }
            // walls strip on left/right
            for (let y = 0; y < h; y++) {
                put(0, y, WALL[0], WALL[1], WALL[2]);
                put(w - 1, y, WALL[0], WALL[1], WALL[2]);
            }
            // start and finish
            put(2, 2, START[0], START[1], START[2]);
            put(w - 3, h - 3, FINISH[0], FINISH[1], FINISH[2]);
            return ctx.getImageData(0, 0, w, h);
        }
        // terraces
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const tier = Math.floor((y / h) * 5); // 5 terraces
                const l = 40 + tier * 35; // step in lightness
                // neutral floor hue (greenish)
                put(x, y, 40, Math.min(255, l), 40);
            }
        }
        // draw horizontal stair lines between terraces using light gray
        for (let t = 1; t < 5; t++) {
            const yLine = Math.floor((t * h) / 5);
            for (let x = 4; x < w - 4; x++)
                put(x, yLine, STAIRS[0], STAIRS[1], STAIRS[2]);
        }
        // perimeter walls
        for (let y = 0; y < h; y++) {
            put(0, y, WALL[0], WALL[1], WALL[2]);
            put(w - 1, y, WALL[0], WALL[1], WALL[2]);
        }
        for (let x = 0; x < w; x++) {
            put(x, 0, WALL[0], WALL[1], WALL[2]);
            put(x, h - 1, WALL[0], WALL[1], WALL[2]);
        }
        // start/finish
        put(2, 2, START[0], START[1], START[2]);
        put(w - 3, h - 3, FINISH[0], FINISH[1], FINISH[2]);
        return ctx.getImageData(0, 0, w, h);
    }
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
System.register("colorMapping", [], function (exports_18, context_18) {
    "use strict";
    var GameElement, DEFAULT_COLOR_MAPPINGS;
    var __moduleName = context_18 && context_18.id;
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    exports_18("hexToRgb", hexToRgb);
    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    exports_18("rgbToHex", rgbToHex);
    function rgbToHsl(r, g, b) {
        const rn = r / 255;
        const gn = g / 255;
        const bn = b / 255;
        const max = Math.max(rn, gn, bn);
        const min = Math.min(rn, gn, bn);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        const d = max - min;
        if (d !== 0) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rn:
                    h = (gn - bn) / d + (gn < bn ? 6 : 0);
                    break;
                case gn:
                    h = (bn - rn) / d + 2;
                    break;
                default:
                    h = (rn - gn) / d + 4;
            }
            h *= 60;
        }
        else {
            h = 0;
            s = 0;
        }
        return { h, s, l };
    }
    exports_18("rgbToHsl", rgbToHsl);
    function colorDistance(color1, color2) {
        return Math.sqrt(Math.pow(color1.r - color2.r, 2) +
            Math.pow(color1.g - color2.g, 2) +
            Math.pow(color1.b - color2.b, 2));
    }
    exports_18("colorDistance", colorDistance);
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
    exports_18("findClosestColor", findClosestColor);
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
                // First try exact palette match; if not close, classify by hue
                let element = findClosestColor(r, g, b, mappings);
                // If it matched to FLOOR and the color isn't exactly white, use hue to classify
                const hex = rgbToHex(r, g, b).toUpperCase();
                const isExactMapped = mappings[hex] !== undefined;
                if (!isExactMapped) {
                    const hsl = rgbToHsl(r, g, b);
                    element = classifyElementByHue(hsl);
                }
                row.push(element);
            }
            gameMap.push(row);
        }
        return gameMap;
    }
    exports_18("imageDataToGameMap", imageDataToGameMap);
    // Classify a tile to a coarse GameElement based on hue; saturation reserved for future
    function classifyElementByHue(hsl) {
        const h = hsl.h;
        const s = hsl.s;
        // If near grayscale and very dark, consider wall to allow hand-authored maps
        if (s < 0.05 && hsl.l < 0.15)
            return GameElement.WALL;
        // Blue → water
        if (h >= 190 && h <= 260)
            return GameElement.WATER;
        // Green → grass
        if (h >= 80 && h <= 160)
            return GameElement.GRASS;
        // Orange → fire
        if (h >= 20 && h <= 40)
            return GameElement.FIRE;
        // Red → danger
        if (h >= 340 || h <= 10)
            return GameElement.DANGER;
        // Magenta → enemy
        if (h >= 280 && h <= 320)
            return GameElement.ENEMY;
        // Yellow → treasure
        if (h >= 50 && h <= 70)
            return GameElement.TREASURE;
        // Cyan → key
        if (h >= 170 && h <= 185)
            return GameElement.KEY;
        // Brown-ish low saturation orange → door
        if (h >= 15 && h <= 35 && s < 0.35)
            return GameElement.DOOR;
        // Light gray → stairs
        if (s < 0.08 && hsl.l > 0.7)
            return GameElement.STAIRS;
        return GameElement.FLOOR;
    }
    exports_18("classifyElementByHue", classifyElementByHue);
    // Extract per-pixel HSL and derived height (meters) from the bitmap
    function extractHslMaps(imageData) {
        const { data, width, height } = imageData;
        const heights = Array.from({ length: height }, () => new Array(width).fill(0));
        const hues = Array.from({ length: height }, () => new Array(width).fill(0));
        const sats = Array.from({ length: height }, () => new Array(width).fill(0));
        const lights = Array.from({ length: height }, () => new Array(width).fill(0));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx], g = data[idx + 1], b = data[idx + 2];
                const hsl = rgbToHsl(r, g, b);
                hues[y][x] = hsl.h;
                sats[y][x] = hsl.s;
                lights[y][x] = hsl.l;
                heights[y][x] = hsl.l * 100.0; // meters 0..100
            }
        }
        return { heights, hues, saturations: sats, lightnesses: lights };
    }
    exports_18("extractHslMaps", extractHslMaps);
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
    exports_18("findPlayerStart", findPlayerStart);
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
    exports_18("findPlayerFinish", findPlayerFinish);
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
    exports_18("findEnemies", findEnemies);
    // Check if a position is walkable (not a wall)
    function isWalkable(gameMap, x, y) {
        if (y < 0 || y >= gameMap.length || x < 0 || x >= gameMap[y].length) {
            return false;
        }
        const element = gameMap[y][x];
        return element !== GameElement.WALL && element !== GameElement.DOOR;
    }
    exports_18("isWalkable", isWalkable);
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
    exports_18("getElementProperties", getElementProperties);
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
            })(GameElement || (exports_18("GameElement", GameElement = {})));
            // Default color mappings based on user requirements
            exports_18("DEFAULT_COLOR_MAPPINGS", DEFAULT_COLOR_MAPPINGS = {
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
System.register("components/drawingCanvas", ["util", "components/common", "colorMapping"], function (exports_19, context_19) {
    "use strict";
    var util_4, common_3, colorMapping_1;
    var __moduleName = context_19 && context_19.id;
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
                saveCanvasState();
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
        // Undo functionality
        let canvasHistory = [];
        let historyIndex = -1;
        const maxHistory = 50; // Maximum undo steps
        // Action colors palette
        const actionColorsContainer = document.createElement("div");
        actionColorsContainer.className = "actionColorsContainer";
        actionColorsContainer.style.display = "flex";
        actionColorsContainer.style.flexWrap = "wrap";
        actionColorsContainer.style.gap = "4px";
        actionColorsContainer.style.marginBottom = "10px";
        actionColorsContainer.style.padding = "8px";
        actionColorsContainer.style.backgroundColor = "#f5f5f5";
        actionColorsContainer.style.borderRadius = "4px";
        const actionColorsTitle = document.createElement("div");
        actionColorsTitle.textContent = "Action Colors (click to select):";
        actionColorsTitle.style.fontSize = "12px";
        actionColorsTitle.style.fontWeight = "bold";
        actionColorsTitle.style.marginBottom = "6px";
        actionColorsTitle.style.width = "100%";
        actionColorsContainer.appendChild(actionColorsTitle);
        // Create color buttons for functional elements
        const actionColors = [
            { color: '#000000', element: colorMapping_1.GameElement.WALL, name: 'Wall' },
            { color: '#FF0000', element: colorMapping_1.GameElement.DANGER, name: 'Danger' },
            { color: '#0000FF', element: colorMapping_1.GameElement.WATER, name: 'Water' },
            { color: '#800080', element: colorMapping_1.GameElement.ENEMY, name: 'Enemy' },
            { color: '#008000', element: colorMapping_1.GameElement.GRASS, name: 'Grass' },
            { color: '#FFA500', element: colorMapping_1.GameElement.FIRE, name: 'Fire' },
            { color: '#006400', element: colorMapping_1.GameElement.PLAYER_START, name: 'Start' },
            { color: '#8B0000', element: colorMapping_1.GameElement.PLAYER_FINISH, name: 'Finish' },
            { color: '#FFFF00', element: colorMapping_1.GameElement.TREASURE, name: 'Treasure' },
            { color: '#FFD700', element: colorMapping_1.GameElement.KEY, name: 'Key' },
            { color: '#8B4513', element: colorMapping_1.GameElement.DOOR, name: 'Door' },
            { color: '#C0C0C0', element: colorMapping_1.GameElement.STAIRS, name: 'Stairs' },
            { color: '#FFFFFF', element: colorMapping_1.GameElement.FLOOR, name: 'Floor' },
        ];
        actionColors.forEach(({ color, element, name }) => {
            const colorButton = document.createElement("button");
            colorButton.className = "actionColorButton";
            colorButton.style.width = "60px";
            colorButton.style.height = "40px";
            colorButton.style.border = "2px solid #ccc";
            colorButton.style.borderRadius = "4px";
            colorButton.style.cursor = "pointer";
            colorButton.style.backgroundColor = color;
            colorButton.style.display = "flex";
            colorButton.style.flexDirection = "column";
            colorButton.style.alignItems = "center";
            colorButton.style.justifyContent = "center";
            colorButton.style.fontSize = "9px";
            colorButton.style.fontWeight = "bold";
            colorButton.style.color = getContrastColor(color);
            colorButton.style.textShadow = "0 0 2px rgba(255,255,255,0.8)";
            colorButton.style.position = "relative";
            // Add border for white color to make it visible
            if (color === '#FFFFFF') {
                colorButton.style.border = "2px solid #333";
                colorButton.style.boxShadow = "inset 0 0 0 1px #333";
            }
            // Add tooltip with full name
            colorButton.title = `${name} (${color})`;
            // Add element properties indicator
            const props = colorMapping_1.getElementProperties(element);
            const indicators = [];
            if (!props.walkable)
                indicators.push('🚫');
            if (props.dangerous)
                indicators.push('⚠️');
            if (props.collectible)
                indicators.push('💎');
            if (props.interactive)
                indicators.push('🎯');
            const indicatorText = indicators.join('');
            if (indicatorText) {
                const indicator = document.createElement("span");
                indicator.textContent = indicatorText;
                indicator.style.fontSize = "8px";
                indicator.style.position = "absolute";
                indicator.style.top = "2px";
                indicator.style.right = "2px";
                colorButton.appendChild(indicator);
            }
            // Shortened name for button
            const shortName = name.length > 6 ? name.substring(0, 6) : name;
            const nameSpan = document.createElement("span");
            nameSpan.textContent = shortName;
            colorButton.appendChild(nameSpan);
            // Click handler
            colorButton.onclick = () => {
                currentColor = color;
                colorInput.value = color;
                // Add visual feedback
                colorButton.style.transform = "scale(0.95)";
                setTimeout(() => {
                    colorButton.style.transform = "scale(1)";
                }, 100);
            };
            // Hover effects
            colorButton.onmouseenter = () => {
                colorButton.style.transform = "scale(1.05)";
                colorButton.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
            };
            colorButton.onmouseleave = () => {
                colorButton.style.transform = "scale(1)";
                colorButton.style.boxShadow = "none";
            };
            actionColorsContainer.appendChild(colorButton);
        });
        // Helper function to get contrasting text color
        function getContrastColor(bgColor) {
            // Simple contrast calculation - return white for dark colors, black for light
            const hex = bgColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            return brightness > 128 ? '#000000' : '#FFFFFF';
        }
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
        // Undo button
        const undoButton = document.createElement("input");
        undoButton.type = "button";
        undoButton.value = "Undo";
        undoButton.disabled = true;
        undoButton.onclick = () => {
            undo();
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
            canvasSize = parseInt(sizeSelect.value);
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            canvas.style.width = `${canvasSize * scaleFactor}px`;
            canvas.style.height = `${canvasSize * scaleFactor}px`;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            saveCanvasState(); // Save state after resize
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
        function saveCanvasState() {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Remove any history after current index (when user draws after undoing)
            canvasHistory = canvasHistory.slice(0, historyIndex + 1);
            // Add new state
            canvasHistory.push(imageData);
            // Keep only the last maxHistory states
            if (canvasHistory.length > maxHistory) {
                canvasHistory.shift();
            }
            else {
                historyIndex++;
            }
            // Enable undo button if we have history
            undoButton.disabled = historyIndex <= 0;
        }
        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                const previousState = canvasHistory[historyIndex];
                ctx.putImageData(previousState, 0, 0);
                undoButton.disabled = historyIndex <= 0;
            }
        }
        // Initialize canvas history with blank state
        saveCanvasState();
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
                saveCanvasState();
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
            // Save canvas state after drawing
            saveCanvasState();
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
            actionColorsContainer,
            common_3.inputGroup(), [
                document.createElement("label"), ["Canvas Size: ", sizeSelect],
                document.createElement("label"), ["Tool: ", toolSelect],
                document.createElement("label"), ["Color: ", colorInput],
                widthLabel, widthInput,
            ],
            common_3.inputGroup(), [
                clearButton,
                undoButton,
                useDrawingButton,
            ],
            canvas,
        ]);
        return component;
    }
    exports_19("createDrawingCanvas", createDrawingCanvas);
    return {
        setters: [
            function (util_4_1) {
                util_4 = util_4_1;
            },
            function (common_3_1) {
                common_3 = common_3_1;
            },
            function (colorMapping_1_1) {
                colorMapping_1 = colorMapping_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/colorReference", ["colorMapping"], function (exports_20, context_20) {
    "use strict";
    var colorMapping_2;
    var __moduleName = context_20 && context_20.id;
    function createColorReference() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "colorReferenceComponent" }),
            updateMappings: (mappings = colorMapping_2.DEFAULT_COLOR_MAPPINGS) => {
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
                const elementProps = colorMapping_2.getElementProperties(gameElement);
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
    exports_20("createColorReference", createColorReference);
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
System.register("components/imageEditor", ["util", "components/common", "components/colorReference"], function (exports_21, context_21) {
    "use strict";
    var util_5, common_4, colorReference_1;
    var __moduleName = context_21 && context_21.id;
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
    exports_21("createImageEditor", createImageEditor);
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
System.register("components/terrain", ["colorMapping"], function (exports_22, context_22) {
    "use strict";
    var colorMapping_3;
    var __moduleName = context_22 && context_22.id;
    // Build a per-tile height map from the color-based game map.
    // Units are in world meters; positive raises ground, negative lowers.
    function buildHeightMap(gameMap) {
        // Default fallback heightmap when none is provided by the caller.
        // Do NOT derive height from tile types; return a flat zero map matching the grid size.
        const rows = gameMap.length;
        const cols = gameMap[0].length;
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }
    exports_22("buildHeightMap", buildHeightMap);
    // Bilinear interpolation of ground height at fractional position
    function sampleHeightBilinear(heights, x, y) {
        const cols = heights[0].length;
        const rows = heights.length;
        const x0 = Math.max(0, Math.floor(x));
        const y0 = Math.max(0, Math.floor(y));
        const x1 = Math.min(cols - 1, x0 + 1);
        const y1 = Math.min(rows - 1, y0 + 1);
        const tx = Math.min(1, Math.max(0, x - x0));
        const ty = Math.min(1, Math.max(0, y - y0));
        const h00 = heights[y0][x0];
        const h10 = heights[y0][x1];
        const h01 = heights[y1][x0];
        const h11 = heights[y1][x1];
        const hx0 = h00 * (1 - tx) + h10 * tx;
        const hx1 = h01 * (1 - tx) + h11 * tx;
        return hx0 * (1 - ty) + hx1 * ty;
    }
    exports_22("sampleHeightBilinear", sampleHeightBilinear);
    // Basic 2D value-noise blended to mimic simplex; deterministic per seed
    function createSimplexLikeNoise(seed) {
        const rand = mulberry32(seed);
        const gradients = [];
        for (let i = 0; i < 256; i++) {
            const a = rand() * Math.PI * 2;
            gradients.push([Math.cos(a), Math.sin(a)]);
        }
        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++)
            perm[i] = (i & 255);
        // Simple shuffle
        for (let i = 255; i > 0; i--) {
            const j = (rand() * (i + 1)) | 0;
            const tmp = perm[i];
            perm[i] = perm[j];
            perm[j] = tmp;
        }
        function dot(ix, iy, x, y) {
            const g = gradients[(perm[(ix + perm[iy & 255]) & 255])];
            return g[0] * x + g[1] * y;
        }
        function fade(t) { return t * t * (3 - 2 * t); }
        return (x, y) => {
            const x0 = Math.floor(x), y0 = Math.floor(y);
            const tx = x - x0, ty = y - y0;
            const n00 = dot(x0, y0, tx, ty);
            const n10 = dot(x0 + 1, y0, tx - 1, ty);
            const n01 = dot(x0, y0 + 1, tx, ty - 1);
            const n11 = dot(x0 + 1, y0 + 1, tx - 1, ty - 1);
            const u = fade(tx), v = fade(ty);
            const nx0 = n00 * (1 - u) + n10 * u;
            const nx1 = n01 * (1 - u) + n11 * u;
            return (nx0 * (1 - v) + nx1 * v); // -1..1 range-ish
        };
    }
    function mulberry32(a) {
        return function () {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    // Detect if a tile is adjacent to water for foam banding
    function isWaterEdge(map, x, y) {
        if (map[y][x] !== colorMapping_3.GameElement.WATER)
            return false;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (ny >= 0 && ny < map.length && nx >= 0 && nx < map[0].length) {
                if (map[ny][nx] !== colorMapping_3.GameElement.WATER)
                    return true;
            }
        }
        return false;
    }
    exports_22("isWaterEdge", isWaterEdge);
    // Build per-tile ceiling height map. Returns absolute world Y values for the ceiling surface.
    function buildCeilingMap(gameMap, floorHeights) {
        const rows = gameMap.length;
        const cols = gameMap[0].length;
        const ceilings = Array.from({ length: rows }, () => new Array(cols).fill(0));
        // Use noise for gentle vaulting; widen over water, tighten over danger
        const noise = createSimplexLikeNoise(4242);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const nx = x / Math.max(1, cols);
                const ny = y / Math.max(1, rows);
                const base = 2.3; // base clearance in meters
                const n = noise(nx * 1.2, ny * 1.2) * 0.35; // -0.35..0.35
                const minGap = 1.9;
                const maxGap = 3.1;
                const desiredGap = clamp(base + n, minGap, maxGap);
                ceilings[y][x] = floorHeights[y][x] + desiredGap;
            }
        }
        // Soft blur to avoid harsh steps
        const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let sum = 0;
                let count = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                            sum += ceilings[ny][nx];
                            count++;
                        }
                    }
                }
                out[y][x] = sum / Math.max(1, count);
            }
        }
        return out;
    }
    exports_22("buildCeilingMap", buildCeilingMap);
    function sampleCeilingBilinear(ceilings, x, y) {
        return sampleHeightBilinear(ceilings, x, y);
    }
    exports_22("sampleCeilingBilinear", sampleCeilingBilinear);
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    return {
        setters: [
            function (colorMapping_3_1) {
                colorMapping_3 = colorMapping_3_1;
            }
        ],
        execute: function () {
        }
    };
});
// Simple procedural icon generator for element sprites
// Produces 32x32 PNG data URLs with minimalist symbols and colors
System.register("components/proceduralSprites", [], function (exports_23, context_23) {
    "use strict";
    var __moduleName = context_23 && context_23.id;
    function generateProceduralSprite(kind, size = 32) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return '';
        // Background transparent
        ctx.clearRect(0, 0, size, size);
        // Helper drawing utilities
        const center = { x: size / 2, y: size / 2 };
        const drawCircle = (x, y, r, fill) => {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();
        };
        const drawRoundedRect = (x, y, w, h, r, fill) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        };
        const drawTriangle = (points, fill) => {
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++)
                ctx.lineTo(points[i].x, points[i].y);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
        };
        const strokeSimple = (color, width = 2) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };
        // Symbol palettes
        const colors = {
            enemy: '#e74c3c',
            danger: '#ff5c33',
            finish: '#2ecc71',
            treasure: '#f1c40f',
            key: '#f1c40f',
            door: '#8e5a3c',
            stairs: '#bdc3c7',
            blade: '#95a5a6',
            fire: '#ff7a1a',
            water: '#4aa3ff',
            grass: '#2ecc71'
        };
        // Draw per kind
        switch (kind) {
            case 'enemy': {
                // Simple skull icon
                drawCircle(center.x, center.y, size * 0.24, colors.enemy);
                strokeSimple('#ffffff');
                ctx.beginPath();
                ctx.moveTo(center.x - 4, center.y + 6);
                ctx.lineTo(center.x + 4, center.y + 6);
                ctx.stroke();
                drawCircle(center.x - 5, center.y - 2, 2, '#ffffff');
                drawCircle(center.x + 5, center.y - 2, 2, '#ffffff');
                break;
            }
            case 'danger': {
                // Warning triangle
                drawTriangle([
                    { x: center.x, y: center.y - 10 },
                    { x: center.x - 11, y: center.y + 9 },
                    { x: center.x + 11, y: center.y + 9 }
                ], colors.danger);
                drawCircle(center.x, center.y + 6, 2, '#ffffff');
                drawRoundedRect(center.x - 1, center.y - 3, 2, 7, 1, '#ffffff');
                break;
            }
            case 'finish': {
                // Checkmark
                drawRoundedRect(4, 4, size - 8, size - 8, 6, colors.finish);
                strokeSimple('#ffffff', 3);
                ctx.beginPath();
                ctx.moveTo(9, center.y + 2);
                ctx.lineTo(center.x - 1, center.y + 8);
                ctx.lineTo(size - 9, 9);
                ctx.stroke();
                break;
            }
            case 'treasure': {
                // Coin
                drawCircle(center.x, center.y, 10, colors.treasure);
                strokeSimple('#ffffff', 2);
                ctx.beginPath();
                ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'key': {
                // Key glyph
                drawCircle(center.x - 5, center.y - 2, 5, colors.key);
                drawRoundedRect(center.x - 1, center.y - 2, 12, 3, 1.5, colors.key);
                drawRoundedRect(center.x + 6, center.y - 4, 2, 2, 1, '#ffffff');
                drawRoundedRect(center.x + 8, center.y - 4, 2, 2, 1, '#ffffff');
                break;
            }
            case 'door': {
                // Door rectangle with knob
                drawRoundedRect(7, 5, size - 14, size - 8, 4, colors.door);
                drawCircle(size - 12, center.y, 2, '#f7e3a1');
                break;
            }
            case 'stairs': {
                // Stair steps
                drawRoundedRect(5, 20, 22, 4, 1, colors.stairs);
                drawRoundedRect(8, 15, 18, 4, 1, colors.stairs);
                drawRoundedRect(11, 10, 14, 4, 1, colors.stairs);
                break;
            }
            case 'blade': {
                // Simple sword
                drawRoundedRect(center.x - 1, 6, 2, 16, 1, colors.blade);
                drawRoundedRect(center.x - 5, 18, 10, 2, 1, '#c99a3b');
                drawTriangle([
                    { x: center.x, y: 4 },
                    { x: center.x - 3, y: 8 },
                    { x: center.x + 3, y: 8 }
                ], colors.blade);
                break;
            }
            case 'fire': {
                // Flame blob
                drawCircle(center.x, center.y + 2, 8, colors.fire);
                drawTriangle([
                    { x: center.x, y: center.y - 8 },
                    { x: center.x - 6, y: center.y + 2 },
                    { x: center.x + 6, y: center.y + 2 }
                ], colors.fire);
                drawCircle(center.x, center.y + 1, 4, '#ffd68a');
                break;
            }
            case 'water': {
                // Droplet
                drawTriangle([
                    { x: center.x, y: 6 },
                    { x: center.x - 7, y: 16 },
                    { x: center.x + 7, y: 16 }
                ], colors.water);
                drawCircle(center.x, 16, 7, colors.water);
                drawCircle(center.x + 2, 12, 2, '#ffffff');
                break;
            }
            case 'grass': {
                // Two-tone dithered tuft
                const dark = '#1f8a4a';
                const light = '#4fd08a';
                drawRoundedRect(6, 24, size - 12, 2, 1, '#1e5c36');
                // base triangle
                drawTriangle([
                    { x: center.x, y: 8 },
                    { x: center.x - 10, y: 24 },
                    { x: center.x + 10, y: 24 }
                ], dark);
                // light dither dots
                ctx.fillStyle = light;
                for (let y = 10; y <= 22; y += 2) {
                    for (let x = 0; x < size; x += 2) {
                        const px = x + ((y % 4) === 0 ? 1 : 0);
                        const py = y;
                        if (px > 6 && px < size - 6 && py < 24) {
                            // within triangle bounds roughly
                            const t = (py - 8) / (24 - 8);
                            const half = 10 * (1 - t);
                            if (px > center.x - half && px < center.x + half)
                                ctx.fillRect(px, py, 1, 1);
                        }
                    }
                }
                // vein
                strokeSimple('#eaffea', 1);
                ctx.beginPath();
                ctx.moveTo(center.x, 12);
                ctx.quadraticCurveTo(center.x + 3, 18, center.x, 24);
                ctx.stroke();
                break;
            }
        }
        return canvas.toDataURL('image/png');
    }
    exports_23("generateProceduralSprite", generateProceduralSprite);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("components/threeJSDungeonCrawler", ["colorMapping", "components/terrain", "gameSettings", "components/proceduralSprites"], function (exports_24, context_24) {
    "use strict";
    var colorMapping_4, terrain_1, gameSettings_2, proceduralSprites_1;
    var __moduleName = context_24 && context_24.id;
    function createThreeJSDungeonCrawler() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "threeJSDungeonCrawlerComponent" }),
            startGame: async (gameMap, playerStart, heightOverrideMeters) => {
                await initializeGame(gameMap, playerStart, heightOverrideMeters);
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
        // UI container for mounting the renderer (no HTML overlays)
        let uiContainer;
        // HUD rendered inside the 3D scene
        let hudHealthCanvas;
        let hudHealthCtx;
        let hudHealthTexture; // THREE.CanvasTexture
        let hudHealthSprite; // THREE.Sprite
        let hudMinimapCanvas;
        let hudMinimapCtx;
        let hudMinimapTexture; // THREE.CanvasTexture
        let hudMinimapSprite; // THREE.Sprite
        // Fancy environment visuals
        let waterMaterials = []; // THREE.ShaderMaterial[]
        let foamMeshes = [];
        let grassSwaySprites = []; // THREE.Sprite[] with sway data
        let glintSprites = []; // collectible shimmer sprites
        let animationId;
        // Postprocessing render targets and quad
        let postRenderTarget;
        let postScene;
        let postCamera;
        let postMaterial;
        let usePostprocessing = true;
        let postHud = null;
        let postControls = null;
        let paletteSelect = null;
        // Game state
        let currentGameMap = [];
        let heightMap = [];
        let ceilingMap = [];
        let stairsGroup = null;
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
        const BASE_WIDTH = 240;
        const BASE_HEIGHT = 160;
        const SCALE_FACTOR = 1; // Upscale to 960x640
        const DISPLAY_SCALE = 4; // final on-screen scale (crisp, nearest)
        const WALL_HEIGHT = 2.0;
        const DISABLE_WALLS = true; // temporarily remove walls (visuals + collisions)
        const MOVE_SPEED = 0.05;
        const ROTATE_SPEED = 0.03;
        // Vertical movement
        let playerVerticalVel = 0;
        const GRAVITY = -9.81 * 0.02; // tuned for frame scale
        const JUMP_VELOCITY = 0.22;
        const STEP_MAX = 0.28; // maximum step height
        const PLAYER_COLLISION_RADIUS = 0.18; // Reduced for smoother movement in tight corridors
        // Input state
        const keysPressed = new Set();
        // Texture loader
        const textureLoader = new THREE.TextureLoader();
        // Mouse look variables
        let mouseX = 0;
        let mouseY = 0;
        let isPointerLocked = false;
        // Debug variables
        let debugMode = false;
        let debugSpheres = [];
        // Particle systems removed for cleaner visuals and performance
        let fireLights = [];
        // Visibility/occlusion data
        const VISIBILITY_RADIUS = 10;
        let visibilityFrameCounter = 0;
        const VISIBILITY_UPDATE_INTERVAL = 2; // Update every 2 frames
        const wallMeshMap = new Map();
        async function initializeGame(gameMap, playerStart, heightOverrideMeters) {
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
            // Initialize Three.js scene
            await setupThreeJS();
            // Create the dungeon geometry
            heightMap = heightOverrideMeters && heightOverrideMeters.length ? heightOverrideMeters : terrain_1.buildHeightMap(currentGameMap);
            ceilingMap = terrain_1.buildCeilingMap(currentGameMap, heightMap);
            createDungeon();
            // In case the spawn is blocked, relocate to nearest walkable tile
            ensureSpawnAccessible();
            // Setup input event listeners
            setupInputListeners();
            // Start the game loop
            gameLoop();
        }
        async function setupThreeJS() {
            // Create scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x202030);
            // Create camera
            camera = new THREE.PerspectiveCamera(75, BASE_WIDTH / BASE_HEIGHT, 0.1, 1000);
            camera.far = 300; // expanded for large vertical ranges
            camera.updateProjectionMatrix();
            camera.position.set(player.x, 1, player.y);
            const groundH0 = (heightMap && heightMap.length > 0) ? terrain_1.sampleHeightBilinear(heightMap, player.x, player.y) : 0;
            camera.lookAt(player.x + Math.cos(player.angle), groundH0 + 1, player.y + Math.sin(player.angle));
            // Create renderer with upscaling
            renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
            renderer.setSize(BASE_WIDTH, BASE_HEIGHT);
            renderer.domElement.style.width = `${BASE_WIDTH * DISPLAY_SCALE}px`;
            renderer.domElement.style.height = `${BASE_HEIGHT * DISPLAY_SCALE}px`;
            renderer.domElement.style.imageRendering = 'pixelated';
            renderer.domElement.style['imageRendering'] = 'pixelated';
            renderer.domElement.style.setProperty('image-rendering', 'pixelated');
            renderer.domElement.style.setProperty('image-rendering', 'crisp-edges');
            renderer.setPixelRatio(1);
            // Enable shadow mapping
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            // Modern color and tone mapping
            if (renderer.outputColorSpace !== undefined) {
                renderer.outputColorSpace = THREE.SRGBColorSpace;
            }
            else if (renderer.outputEncoding !== undefined) {
                renderer.outputEncoding = THREE.sRGBEncoding;
            }
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            // UI container
            uiContainer = document.createElement('div');
            uiContainer.style.position = 'relative';
            uiContainer.style.width = `${BASE_WIDTH * DISPLAY_SCALE}px`;
            uiContainer.style.height = `${BASE_HEIGHT * DISPLAY_SCALE}px`;
            // Mount renderer inside UI container
            uiContainer.appendChild(renderer.domElement);
            // component.domElement is typed as Node; cast to HTMLElement for DOM ops
            const hostEl = component.domElement;
            hostEl.innerHTML = '';
            hostEl.appendChild(uiContainer);
            // Create HUD canvases (offscreen) and sprites attached to camera
            // Health bar canvas
            hudHealthCanvas = document.createElement('canvas');
            hudHealthCanvas.width = 128;
            hudHealthCanvas.height = 16;
            hudHealthCtx = hudHealthCanvas.getContext('2d');
            hudHealthTexture = new THREE.CanvasTexture(hudHealthCanvas);
            hudHealthTexture.magFilter = THREE.NearestFilter;
            hudHealthTexture.minFilter = THREE.NearestFilter;
            hudHealthTexture.generateMipmaps = false;
            const hbMat = new THREE.SpriteMaterial({ map: hudHealthTexture, transparent: true, depthWrite: false });
            hudHealthSprite = new THREE.Sprite(hbMat);
            hudHealthSprite.scale.set(0.9, 0.12, 1);
            hudHealthSprite.position.set(0, -0.68, -1.1);
            hudHealthSprite.renderOrder = 9999;
            hudHealthSprite.material.depthTest = false;
            hudHealthSprite.material.depthWrite = false;
            camera.add(hudHealthSprite);
            scene.add(camera); // ensure camera is in scene for children rendering
            // Minimap canvas
            hudMinimapCanvas = document.createElement('canvas');
            hudMinimapCanvas.width = 128;
            hudMinimapCanvas.height = 128;
            hudMinimapCtx = hudMinimapCanvas.getContext('2d');
            hudMinimapTexture = new THREE.CanvasTexture(hudMinimapCanvas);
            hudMinimapTexture.magFilter = THREE.NearestFilter;
            hudMinimapTexture.minFilter = THREE.NearestFilter;
            hudMinimapTexture.generateMipmaps = false;
            const mmMat = new THREE.SpriteMaterial({ map: hudMinimapTexture, transparent: true, depthWrite: false });
            hudMinimapSprite = new THREE.Sprite(mmMat);
            hudMinimapSprite.scale.set(0.42, 0.42, 1);
            hudMinimapSprite.position.set(0.8, 0.55, -1.2);
            hudMinimapSprite.renderOrder = 9999;
            hudMinimapSprite.material.depthTest = false;
            hudMinimapSprite.material.depthWrite = false;
            camera.add(hudMinimapSprite);
            // Blue overlay for underwater effect (hidden by default)
            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.width = 64;
            overlayCanvas.height = 64; // tiny, pixelated
            const octx = overlayCanvas.getContext('2d');
            if (octx) {
                octx.fillStyle = 'rgba(0,0,0,0)';
                octx.fillRect(0, 0, 64, 64);
            }
            const overlayTex = new THREE.CanvasTexture(overlayCanvas);
            overlayTex.magFilter = THREE.NearestFilter;
            overlayTex.minFilter = THREE.NearestFilter;
            overlayTex.generateMipmaps = false;
            const overlayMat = new THREE.SpriteMaterial({ map: overlayTex, transparent: true, depthTest: false, depthWrite: false });
            const overlaySprite = new THREE.Sprite(overlayMat);
            overlaySprite.scale.set(1.6, 0.9, 1);
            overlaySprite.position.set(0, 0, -0.9);
            overlaySprite.renderOrder = 10000;
            camera.add(overlaySprite);
            // Store for updates
            scene.waterOverlay = { canvas: overlayCanvas, ctx: octx, texture: overlayTex, sprite: overlaySprite };
            renderer.useLegacyLights = false;
            // Advanced lighting system
            setupLighting();
            // Enable shadows
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            // Add renderer to DOM
            component.domElement.appendChild(renderer.domElement);
            component.domElement.style.display = 'inline-block';
            component.domElement.style.lineHeight = '0';
            // Create low-res render target for pixel-art upscale
            postRenderTarget = new THREE.WebGLRenderTarget(BASE_WIDTH, BASE_HEIGHT, {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                depthBuffer: true,
                stencilBuffer: false
            });
            // Fullscreen quad and shader
            postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            postScene = new THREE.Scene();
            postMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: postRenderTarget.texture },
                    resolution: { value: new THREE.Vector2(BASE_WIDTH, BASE_HEIGHT) },
                    time: { value: 0 },
                    saturation: { value: 1.25 },
                    contrast: { value: 1.1 },
                    vignette: { value: 0.2 },
                    bloomStrength: { value: 0.6 },
                    bloomThreshold: { value: 0.7 },
                    ditherAmount: { value: 0.02 },
                    paletteMode: { value: 0 }
                },
                vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
                fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float time;
        uniform float saturation;
        uniform float contrast;
        uniform float vignette;
        uniform float bloomStrength;
        uniform float bloomThreshold;
        uniform float ditherAmount;
        uniform int paletteMode; // 0 None, 1 GameBoy, 2 CRT, 3 Retro16

        // Bayer 4x4 matrix for ordered dithering
        float bayer(vec2 uv) {
          int x = int(mod(floor(uv.x), 4.0));
          int y = int(mod(floor(uv.y), 4.0));
          int index = x + y * 4;
          int mat[16];
          mat[0]=0; mat[1]=8; mat[2]=2; mat[3]=10;
          mat[4]=12; mat[5]=4; mat[6]=14; mat[7]=6;
          mat[8]=3; mat[9]=11; mat[10]=1; mat[11]=9;
          mat[12]=15; mat[13]=7; mat[14]=13; mat[15]=5;
          return float(mat[index]) / 16.0;
        }

        vec3 saturateColor(vec3 color, float s) {
          float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(l), color, s);
        }

        vec3 applyPalette(vec3 c) {
          if (paletteMode == 0) return c;
          if (paletteMode == 1) {
            // Game Boy 4-color palette
            vec3 p0 = vec3(0.055, 0.094, 0.071);
            vec3 p1 = vec3(0.214, 0.353, 0.235);
            vec3 p2 = vec3(0.494, 0.706, 0.400);
            vec3 p3 = vec3(0.800, 0.949, 0.565);
            float g = dot(c, vec3(0.299, 0.587, 0.114));
            if (g < 0.25) return p0; else if (g < 0.5) return p1; else if (g < 0.75) return p2; else return p3;
          }
          if (paletteMode == 2) {
            // CRT-ish: slight scanline and phosphor tint
            float scan = 0.08 * sin(vUv.y * resolution.y * 3.14159);
            c *= 1.0 - scan;
            c *= vec3(1.05, 1.0, 1.1);
            return clamp(c, 0.0, 1.0);
          }
          if (paletteMode == 3) {
            // 16-color retro quantization (simple)
            vec3 pal[16];
            pal[0]=vec3(0.0,0.0,0.0); pal[1]=vec3(0.2,0.2,0.2); pal[2]=vec3(0.4,0.4,0.4); pal[3]=vec3(0.6,0.6,0.6);
            pal[4]=vec3(0.8,0.8,0.8); pal[5]=vec3(1.0,1.0,1.0); pal[6]=vec3(1.0,0.0,0.0); pal[7]=vec3(0.0,1.0,0.0);
            pal[8]=vec3(0.0,0.0,1.0); pal[9]=vec3(1.0,1.0,0.0); pal[10]=vec3(1.0,0.0,1.0); pal[11]=vec3(0.0,1.0,1.0);
            pal[12]=vec3(1.0,0.5,0.0); pal[13]=vec3(0.5,0.0,1.0); pal[14]=vec3(0.2,0.9,0.9); pal[15]=vec3(0.9,0.2,0.6);
            float best = 1e9; int bi = 0;
            for (int i=0;i<16;i++) {
              float d = dot(c - pal[i], c - pal[i]);
              if (d < best) { best = d; bi = i; }
            }
            return pal[bi];
          }
          return c;
        }

        void main() {
          vec2 texel = 1.0 / resolution;
          // Snap UVs to texel grid for crisp pixels
          vec2 snappedUv = (floor(vUv * resolution) + 0.5) * texel;
          vec4 base = texture2D(tDiffuse, snappedUv);

          // Simple bright-pass and small-kernel bloom
          vec3 c = base.rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          vec3 bright = max(c - bloomThreshold, 0.0);
          vec3 blur = (
            texture2D(tDiffuse, snappedUv + vec2(texel.x, 0.0)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(-texel.x, 0.0)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(0.0, texel.y)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(0.0, -texel.y)).rgb
          ) * 0.25;
          vec3 bloom = bright * blur * bloomStrength;
          c += bloom;

          // Vibrancy
          c = saturateColor(c, saturation);
          c = (c - 0.5) * contrast + 0.5;

          // Palette
          c = applyPalette(c);

          // Vignette
          float dist = distance(vUv, vec2(0.5));
          float vig = 1.0 - smoothstep(0.6, 1.0, dist);
          c *= mix(1.0, vig, vignette);

          // Ordered dithering
          float d = bayer(vUv * resolution) - 0.5;
          c += ditherAmount * d;

          gl_FragColor = vec4(c, 1.0);
        }
      `,
                depthTest: false,
                depthWrite: false
            });
            const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
            postScene.add(postQuad);
            // Palette hotkeys: 1 None, 2 GameBoy, 3 CRT, 4 Retro16
            window.addEventListener('keydown', (ev) => {
                const k = (ev.key || '').toLowerCase();
                if (k === '1' && postMaterial)
                    postMaterial.uniforms.paletteMode.value = 0;
                if (k === '2' && postMaterial)
                    postMaterial.uniforms.paletteMode.value = 1;
                if (k === '3' && postMaterial)
                    postMaterial.uniforms.paletteMode.value = 2;
                if (k === '4' && postMaterial)
                    postMaterial.uniforms.paletteMode.value = 3;
                if (k === 'p')
                    usePostprocessing = !usePostprocessing;
                updatePostHud();
            });
            // HUD overlay to show post status and palette
            postHud = document.createElement('div');
            postHud.style.cssText = 'position:absolute; top:6px; right:8px; padding:4px 6px; background:rgba(0,0,0,0.5); color:#fff; font:12px monospace; border-radius:3px; z-index: 9999;';
            component.domElement.style.position = 'relative';
            component.domElement.appendChild(postHud);
            // On-screen controls (guaranteed toggles)
            postControls = document.createElement('div');
            postControls.style.cssText = 'position:absolute; top:6px; left:8px; display:flex; gap:6px; align-items:center; z-index: 10000; background:rgba(0,0,0,0.35); padding:4px 6px; border-radius:3px;';
            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'Toggle Post';
            toggleBtn.style.cssText = 'font:12px monospace; cursor:pointer;';
            toggleBtn.onclick = (e) => { e.stopPropagation(); usePostprocessing = !usePostprocessing; updatePostHud(); };
            paletteSelect = document.createElement('select');
            paletteSelect.style.cssText = 'font:12px monospace;';
            ;
            ['None', 'GameBoy', 'CRT', 'Retro16'].forEach((label, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.text = label;
                paletteSelect.appendChild(opt);
            });
            paletteSelect.onchange = (e) => {
                const v = parseInt(e.target.value, 10) | 0;
                if (postMaterial)
                    postMaterial.uniforms.paletteMode.value = v;
                updatePostHud();
            };
            postControls.appendChild(toggleBtn);
            postControls.appendChild(paletteSelect);
            component.domElement.appendChild(postControls);
            updatePostHud();
        }
        function setupLighting() {
            // Ambient and hemisphere fill for general visibility
            const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x404040, 0.9);
            scene.add(hemi);
            const ambient = new THREE.AmbientLight(0xffffff, 0.35);
            scene.add(ambient);
            // Player torch light (follows player)
            const s = gameSettings_2.getSettings();
            const playerTorch = new THREE.PointLight(0xffc866, s.playerLightIntensity, 16);
            playerTorch.position.set(player.x, 1.5, player.y);
            playerTorch.castShadow = true;
            // Enhanced shadow settings
            playerTorch.shadow.mapSize.width = 2048;
            playerTorch.shadow.mapSize.height = 2048;
            playerTorch.shadow.camera.near = 0.1;
            playerTorch.shadow.camera.far = 120;
            playerTorch.shadow.bias = -0.0002;
            scene.add(playerTorch);
            // Store reference to player torch for updates
            scene.playerTorch = playerTorch;
            // Softer, farther fog so the scene is not too dark
            scene.fog = new THREE.Fog(0x202030, 18, 80);
            // React to runtime settings changes (light intensity and post)
            gameSettings_2.onSettingsChange((key) => {
                if (key === 'playerLightIntensity') {
                    scene.playerTorch.intensity = gameSettings_2.getSettings().playerLightIntensity;
                }
            });
        }
        function createDungeon() {
            const mapWidth = currentGameMap[0].length;
            const mapHeight = currentGameMap.length;
            // Create floor
            createFloor(mapWidth, mapHeight);
            // Create walls (disabled for now)
            createWalls(mapWidth, mapHeight);
            // Create stairs bridging height gaps between adjacent walkable tiles
            createStairs(mapWidth, mapHeight);
            // Create sprites for interactive elements
            createSprites();
            // Setup fire lights for flame tiles (particles removed)
            createFireLightsForMap();
            // Initialize debug visualization
            createDebugSpheres();
            // Initial visibility update to prevent overdraw on first frames
            updateVisibility();
        }
        function createFloor(width, height) {
            // Create a height-aware floor; allow extra subdivisions for smoothness
            const subdiv = Math.max(1, Math.min(4, gameSettings_2.getSettings().heightMeshSubdivision || 1));
            const floorGeometry = new THREE.PlaneGeometry(width, height, width * subdiv, height * subdiv);
            // Load floor texture
            const floorTexture = textureLoader.load('textures/floor_stone.png');
            floorTexture.wrapS = THREE.RepeatWrapping;
            floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.repeat.set(width / 4, height / 4);
            // Improve texture quality and color accuracy
            if (floorTexture.colorSpace !== undefined) {
                floorTexture.colorSpace = THREE.SRGBColorSpace;
            }
            else if (floorTexture.encoding !== undefined) {
                floorTexture.encoding = THREE.sRGBEncoding;
            }
            if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
                floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            const floorMaterial = new THREE.MeshStandardMaterial({
                map: floorTexture,
                roughness: 0.95,
                metalness: 0.0,
                emissive: new THREE.Color(0x1a1a1a),
                emissiveIntensity: 0.08
            });
            // Apply per-vertex heights from heightMap
            const pos = floorGeometry.attributes.position;
            const vprFloor = width * subdiv + 1; // vertices per row
            for (let y = 0; y <= height * subdiv; y++) {
                for (let x = 0; x <= width * subdiv; x++) {
                    const idx = (y * vprFloor + x) * 3;
                    // PlaneGeometry is centered; offset to grid space
                    const gx = x / subdiv - 0.5;
                    const gy = y / subdiv - 0.5;
                    const h = terrain_1.sampleHeightBilinear(heightMap, gx, gy);
                    // Before rotation, z becomes world Y after we rotate floor by -PI/2
                    pos.array[idx + 2] = h;
                }
            }
            pos.needsUpdate = true;
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
            floor.receiveShadow = true;
            floor.frustumCulled = false; // ensure floor remains visible with short far plane
            scene.add(floor);
            // Create ceiling
            createCeiling(width, height);
        }
        function createCeiling(width, height) {
            // Create ceiling geometry with per-vertex heights from ceilingMap
            const subdiv = Math.max(1, Math.min(4, gameSettings_2.getSettings().heightMeshSubdivision || 1));
            const ceilingGeometry = new THREE.PlaneGeometry(width, height, width * subdiv, height * subdiv);
            // Load ceiling texture
            const ceilingTexture = textureLoader.load('textures/ceiling_stone.png');
            ceilingTexture.wrapS = THREE.RepeatWrapping;
            ceilingTexture.wrapT = THREE.RepeatWrapping;
            ceilingTexture.repeat.set(width / 4, height / 4);
            if (ceilingTexture.colorSpace !== undefined) {
                ceilingTexture.colorSpace = THREE.SRGBColorSpace;
            }
            else if (ceilingTexture.encoding !== undefined) {
                ceilingTexture.encoding = THREE.sRGBEncoding;
            }
            if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
                ceilingTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            const ceilingMaterial = new THREE.MeshStandardMaterial({
                map: ceilingTexture,
                roughness: 0.98,
                metalness: 0.0,
                emissive: new THREE.Color(0x0e0e12),
                emissiveIntensity: 0.06
            });
            // Height displacements: encode gap by moving vertices down locally
            const pos = ceilingGeometry.attributes.position;
            const vprCeil = width * subdiv + 1;
            for (let y = 0; y <= height * subdiv; y++) {
                for (let x = 0; x <= width * subdiv; x++) {
                    const idx = (y * vprCeil + x) * 3;
                    const gx = x / subdiv - 0.5;
                    const gy = y / subdiv - 0.5;
                    const cH = terrain_1.sampleCeilingBilinear(ceilingMap, gx, gy);
                    pos.array[idx + 2] = cH; // will rotate to face down
                }
            }
            pos.needsUpdate = true;
            const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
            ceiling.rotation.x = Math.PI / 2; // Rotate to face down
            ceiling.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
            ceiling.receiveShadow = true;
            ceiling.frustumCulled = false; // ensure ceiling remains visible
            scene.add(ceiling);
        }
        function createWalls(width, height) {
            if (DISABLE_WALLS)
                return; // skip visual walls entirely
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const element = currentGameMap[y][x];
                    const properties = colorMapping_4.getElementProperties(element);
                    if (!properties.walkable) {
                        createWallFaces(x, y, element);
                    }
                }
            }
        }
        function createWallFaces(x, y, element) {
            const wallTexture = getWallTexture(element);
            const mat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9, metalness: 0.0, emissive: new THREE.Color(0x121820), emissiveIntensity: 0.08, side: THREE.FrontSide });
            // For each of 4 edges, if neighbor is walkable or out of bounds, create a vertical face conforming to ground
            const edges = [
                { dx: 1, dy: 0 }, // east
                { dx: -1, dy: 0 }, // west
                { dx: 0, dy: 1 }, // south
                { dx: 0, dy: -1 } // north
            ];
            for (const e of edges) {
                const nx = x + e.dx;
                const ny = y + e.dy;
                const neighborWalkable = (ny < 0 || ny >= currentGameMap.length || nx < 0 || nx >= currentGameMap[0].length)
                    ? true
                    : colorMapping_4.getElementProperties(currentGameMap[ny][nx]).walkable;
                if (!neighborWalkable)
                    continue;
                // Edge endpoints in world (XZ plane), with vertical Y from heightMap
                let p0x = x, p0z = y, p1x = x, p1z = y;
                if (e.dx === 1 && e.dy === 0) { // east edge: x+0.5, y-0.5 -> y+0.5
                    p0x = x + 0.5;
                    p0z = y - 0.5;
                    p1x = x + 0.5;
                    p1z = y + 0.5;
                }
                else if (e.dx === -1 && e.dy === 0) { // west edge: x-0.5, y+0.5 -> y-0.5
                    p0x = x - 0.5;
                    p0z = y + 0.5;
                    p1x = x - 0.5;
                    p1z = y - 0.5;
                }
                else if (e.dx === 0 && e.dy === 1) { // south edge: x+0.5, y+0.5 -> x-0.5, y+0.5
                    p0x = x + 0.5;
                    p0z = y + 0.5;
                    p1x = x - 0.5;
                    p1z = y + 0.5;
                }
                else if (e.dx === 0 && e.dy === -1) { // north edge: x-0.5, y-0.5 -> x+0.5, y-0.5
                    p0x = x - 0.5;
                    p0z = y - 0.5;
                    p1x = x + 0.5;
                    p1z = y - 0.5;
                }
                const b0y = terrain_1.sampleHeightBilinear(heightMap, p0x, p0z);
                const b1y = terrain_1.sampleHeightBilinear(heightMap, p1x, p1z);
                const t0y = b0y + WALL_HEIGHT;
                const t1y = b1y + WALL_HEIGHT;
                // Build a quad (two triangles) with vertices ordered to face outward toward the neighbor
                const vertices = [
                    p0x, b0y, p0z,
                    p1x, b1y, p1z,
                    p1x, t1y, p1z,
                    p0x, b0y, p0z,
                    p1x, t1y, p1z,
                    p0x, t0y, p0z,
                ];
                const uvs = [
                    0, 0,
                    1, 0,
                    1, 1,
                    0, 0,
                    1, 1,
                    0, 1,
                ];
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                geometry.computeVertexNormals();
                const mesh = new THREE.Mesh(geometry, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                scene.add(mesh);
            }
        }
        function createStairs(width, height) {
            if (stairsGroup) {
                scene.remove(stairsGroup);
                stairsGroup = null;
            }
            const group = new THREE.Group();
            stairsGroup = group;
            const MAX_STEPS = 12;
            const MIN_DH = 0.12; // minimum height difference to bother with stairs
            const MAX_DH = 3.5; // maximum supported difference for auto stairs
            const STEP_RUN = 0.18; // horizontal depth per step
            const MAX_SPAN = 0.9; // do not extend beyond tile bounds
            const material = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.95, metalness: 0.0 });
            const dirs = [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
            ];
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const el = currentGameMap[y][x];
                    const props = colorMapping_4.getElementProperties(el);
                    if (!props.walkable)
                        continue;
                    const h0 = terrain_1.sampleHeightBilinear(heightMap, x + 0.5, y + 0.5);
                    for (const d of dirs) {
                        const nx = x + d.dx;
                        const ny = y + d.dy;
                        if (ny < 0 || ny >= height || nx < 0 || nx >= width)
                            continue;
                        const elN = currentGameMap[ny][nx];
                        const pN = colorMapping_4.getElementProperties(elN);
                        if (!pN.walkable)
                            continue;
                        const h1 = terrain_1.sampleHeightBilinear(heightMap, nx + 0.5, ny + 0.5);
                        const dh = h1 - h0;
                        const absDh = Math.abs(dh);
                        // Only build stairs when at least one tile is explicitly a STAIRS tile
                        if (!(currentGameMap[y][x] === colorMapping_4.GameElement.STAIRS || currentGameMap[ny][nx] === colorMapping_4.GameElement.STAIRS))
                            continue;
                        if (absDh < MIN_DH || absDh > MAX_DH)
                            continue;
                        // Build a ramp of steps from lower to higher tile along the direction
                        const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(absDh / 0.22)));
                        const actualRise = dh / steps; // signed per-step rise
                        const run = Math.min(MAX_SPAN, steps * STEP_RUN);
                        const stepDepth = run / steps;
                        for (let s = 0; s < steps; s++) {
                            const t0 = (s / steps) * run;
                            const t1 = ((s + 1) / steps) * run;
                            const w = 0.8; // width of stairs slab
                            const slabH = 0.03; // thickness of each step slab
                            const geo = new THREE.BoxGeometry(d.dy === 0 ? stepDepth : w, slabH, d.dx === 0 ? stepDepth : w);
                            const mesh = new THREE.Mesh(geo, material);
                            // Center start within the tile, extend towards neighbor
                            const cx = x + 0.5 + (d.dx * (t0 + stepDepth * 0.5));
                            const cy = y + 0.5 + (d.dy * (t0 + stepDepth * 0.5));
                            // Vertical placement interpolates along steps
                            const baseH = h0 + actualRise * (s + 1); // top surface height for this step
                            mesh.position.set(cx, baseH + slabH * 0.5 + 0.005, cy);
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;
                            group.add(mesh);
                        }
                    }
                }
            }
            scene.add(group);
        }
        function getWallTexture(element) {
            let texturePath;
            switch (element) {
                case colorMapping_4.GameElement.WALL:
                    texturePath = 'textures/wall_stone.png';
                    break;
                case colorMapping_4.GameElement.DOOR:
                    texturePath = 'textures/wood_texture.png';
                    break;
                case colorMapping_4.GameElement.DANGER:
                    texturePath = 'textures/danger_texture.png';
                    break;
                case colorMapping_4.GameElement.FIRE:
                    texturePath = 'textures/fire_texture.png';
                    break;
                default:
                    texturePath = 'textures/wall_stone.png';
            }
            const texture = textureLoader.load(texturePath);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            // Improve color and sampling for readability
            if (texture.colorSpace !== undefined) {
                texture.colorSpace = THREE.SRGBColorSpace;
            }
            else if (texture.encoding !== undefined) {
                texture.encoding = THREE.sRGBEncoding;
            }
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
                texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            }
            return texture;
        }
        function createSprites() {
            for (let y = 0; y < currentGameMap.length; y++) {
                for (let x = 0; x < currentGameMap[y].length; x++) {
                    const element = currentGameMap[y][x];
                    // Create sprites for ALL elements that have sprites, not just interactive ones
                    // Skip WALL since walls are handled by createWalls()
                    if (element !== colorMapping_4.GameElement.WALL && element !== colorMapping_4.GameElement.FLOOR) {
                        createSprite(x, y, element);
                        // Add collectible glint shimmer for treasures and keys
                        if (element === colorMapping_4.GameElement.TREASURE || element === colorMapping_4.GameElement.KEY) {
                            const tex = new THREE.TextureLoader().load(proceduralSprites_1.generateProceduralSprite('treasure'));
                            tex.minFilter = THREE.NearestFilter;
                            tex.magFilter = THREE.NearestFilter;
                            tex.generateMipmaps = false;
                            const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
                            const s = new THREE.Sprite(mat);
                            const h = terrain_1.sampleHeightBilinear(heightMap, x, y);
                            s.position.set(x, h + 0.9, y);
                            s.scale.set(0.5, 0.5, 1);
                            s.glint = true;
                            s.phase = Math.random() * Math.PI * 2;
                            scene.add(s);
                            glintSprites.push(s);
                        }
                    }
                }
            }
        }
        function createSprite(x, y, element) {
            const spritePath = getSpritePath(element);
            if (spritePath) {
                // Create sprite with texture
                // Support data URLs returned by generator
                const texture = spritePath.startsWith('data:') ? new THREE.TextureLoader().load(spritePath) : textureLoader.load(spritePath);
                // Make pixel art crisp and avoid blurry squares
                if (texture) {
                    if (texture.colorSpace !== undefined) {
                        texture.colorSpace = THREE.SRGBColorSpace;
                    }
                    else if (texture.encoding !== undefined) {
                        texture.encoding = THREE.sRGBEncoding;
                    }
                    texture.minFilter = THREE.NearestFilter;
                    texture.magFilter = THREE.NearestFilter;
                    texture.generateMipmaps = false;
                    texture.needsUpdate = true;
                }
                const spriteMaterial = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    fog: true,
                    depthWrite: false,
                    alphaTest: 0.05
                });
                const sprite = new THREE.Sprite(spriteMaterial);
                const gh = terrain_1.sampleHeightBilinear(heightMap, x, y);
                sprite.position.set(x, gh + 0.9, y);
                sprite.scale.set(0.6, 0.6, 0.6);
                scene.add(sprite);
                // Add emissive glow for certain elements
                if (false && (element === colorMapping_4.GameElement.FIRE || element === colorMapping_4.GameElement.TREASURE)) {
                    const glowColor = element === colorMapping_4.GameElement.FIRE ? 0xffa200 : 0xffee66;
                    const glowTex = new THREE.TextureLoader().load(proceduralSprites_1.generateProceduralSprite(element === colorMapping_4.GameElement.FIRE ? 'fire' : 'treasure'));
                    const glowMat = new THREE.SpriteMaterial({
                        map: glowTex,
                        color: glowColor,
                        transparent: true,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        fog: true,
                        opacity: element === colorMapping_4.GameElement.FIRE ? 0.5 : 0.65
                    });
                    const glow = new THREE.Sprite(glowMat);
                    glow.position.set(x, 0.95, y);
                    glow.scale.set(0.9, 0.9, 0.9);
                    glow.pulse = true;
                    scene.add(glow);
                    // glow disabled
                }
                // For environment tiles, prefer custom ground visuals only (no hovering icons)
                if (element === colorMapping_4.GameElement.GRASS || element === colorMapping_4.GameElement.WATER || element === colorMapping_4.GameElement.DANGER || element === colorMapping_4.GameElement.FIRE) {
                    // Remove the sprite we just created and use ground visuals instead
                    scene.remove(sprite);
                    if (element === colorMapping_4.GameElement.FIRE || element === colorMapping_4.GameElement.DANGER) {
                        // Keep only ground tile; no glow sprite for now
                        createColoredQuad(x, y, element);
                    }
                    else {
                        createColoredQuad(x, y, element);
                    }
                    return;
                }
            }
            else {
                // Create colored quad for elements without sprites
                createColoredQuad(x, y, element);
            }
        }
        function createColoredQuad(x, y, element) {
            // Conforming ground tiles subdivided to enhance continuity between tiles
            const size = 1.0;
            const segments = 2; // break one tile into 4 subtiles
            const geom = new THREE.PlaneGeometry(size, size, segments, segments);
            const pos = geom.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const lx = pos.getX(i); // local -0.5..0.5
                const ly = pos.getY(i);
                const wx = x + lx;
                const wy = y + ly;
                const h = terrain_1.sampleHeightBilinear(heightMap, wx, wy);
                pos.setZ(i, h);
            }
            pos.needsUpdate = true;
            geom.computeVertexNormals();
            const color = getElementColor(element);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0.0, transparent: true, opacity: 0.92, side: THREE.DoubleSide, fog: true });
            const tile = new THREE.Mesh(geom, mat);
            tile.rotation.x = -Math.PI / 2;
            tile.position.set(x, 0.0, y);
            tile.receiveShadow = true;
            scene.add(tile);
            if (element === colorMapping_4.GameElement.GRASS) {
                // Add 3 swaying grass blades as sprites
                for (let i = 0; i < 3; i++) {
                    const tex = new THREE.TextureLoader().load(proceduralSprites_1.generateProceduralSprite('grass'));
                    tex.minFilter = THREE.NearestFilter;
                    tex.magFilter = THREE.NearestFilter;
                    tex.generateMipmaps = false;
                    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, alphaTest: 0.05 });
                    const s = new THREE.Sprite(mat);
                    const gh = terrain_1.sampleHeightBilinear(heightMap, x, y);
                    s.position.set(x + (Math.random() - 0.5) * 0.5, gh + 0.12, y + (Math.random() - 0.5) * 0.5);
                    s.scale.set(0.35, 0.35, 1);
                    s.swayPhase = Math.random() * Math.PI * 2;
                    s.castShadow = true;
                    scene.add(s);
                    grassSwaySprites.push(s);
                }
            }
            else if (element === colorMapping_4.GameElement.WATER) {
                // Water surface that conforms loosely to terrain with slight offset
                const waterGeo = new THREE.PlaneGeometry(size, size, 4, 4);
                const wp = waterGeo.attributes.position;
                for (let i = 0; i < wp.count; i++) {
                    const lx = wp.getX(i);
                    const ly = wp.getY(i);
                    const wx = x + lx;
                    const wy = y + ly;
                    const h = terrain_1.sampleHeightBilinear(heightMap, wx, wy) + 0.03;
                    wp.setZ(i, h);
                }
                wp.needsUpdate = true;
                waterGeo.computeVertexNormals();
                const waterMat = new THREE.ShaderMaterial({
                    uniforms: { time: { value: 0 }, baseColor: { value: new THREE.Color(0x4aa3ff) } },
                    vertexShader: `
          uniform float time;
          void main() {
            vec3 p = position;
            p.z += sin((position.x + position.y) * 6.0 + time * 2.0) * 0.015;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
                    fragmentShader: `
          uniform vec3 baseColor;
          void main(){
            gl_FragColor = vec4(baseColor, 0.85);
          }
        `,
                    transparent: true,
                    depthWrite: false
                });
                const water = new THREE.Mesh(waterGeo, waterMat);
                water.rotation.x = -Math.PI / 2;
                water.position.set(x, 0.0, y);
                water.receiveShadow = true; // catch soft caustic shadows from scene lights
                scene.add(water);
                waterMaterials.push(waterMat);
                // Foam ring for water edges
                if (terrain_1.isWaterEdge(currentGameMap, Math.floor(x), Math.floor(y))) {
                    const foam = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.48, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
                    foam.rotation.x = -Math.PI / 2;
                    const gh = terrain_1.sampleHeightBilinear(heightMap, x, y);
                    foam.position.set(x, gh + 0.035, y);
                    foam.renderOrder = 3;
                    scene.add(foam);
                    foamMeshes.push(foam);
                }
            }
        }
        function createFireLightsForMap() {
            // Clear existing fire lights
            fireLights.forEach(light => scene.remove(light));
            fireLights = [];
            for (let y = 0; y < currentGameMap.length; y++) {
                for (let x = 0; x < currentGameMap[y].length; x++) {
                    const element = currentGameMap[y][x];
                    if (element === colorMapping_4.GameElement.FIRE) {
                        createFireLight(x, y);
                    }
                }
            }
        }
        // Particles removed
        // No particle config needed
        function createFireLight(x, y) {
            const fireLight = new THREE.PointLight(0xffaa44, 1.1, 8);
            const gh = terrain_1.sampleHeightBilinear(heightMap, x, y);
            fireLight.position.set(x, gh + 0.8, y);
            fireLight.castShadow = false; // Don't cast shadows to avoid performance issues
            scene.add(fireLight);
            fireLights.push(fireLight);
        }
        // Update fire light flicker and animated materials
        function updateSceneEffects() {
            const time = Date.now() * 0.001;
            fireLights.forEach((light, index) => {
                const baseIntensity = 0.8;
                const flicker = Math.sin(time * 8 + index) * 0.2 + Math.sin(time * 12 + index * 2) * 0.1;
                light.intensity = baseIntensity + flicker;
            });
            waterMaterials.forEach((mat) => {
                if (mat.uniforms && mat.uniforms.time) {
                    mat.uniforms.time.value = time;
                }
            });
            grassSwaySprites.forEach((s, idx) => {
                const phase = s.swayPhase || 0;
                s.rotation.z = Math.sin(time * 2.0 + phase) * 0.08;
            });
            foamMeshes.forEach((m, idx) => {
                const mat = m.material;
                if (mat && mat.opacity !== undefined) {
                    mat.opacity = 0.45 + Math.sin(time * 2.5 + idx) * 0.1;
                }
            });
        }
        function getElementColor(element) {
            switch (element) {
                case colorMapping_4.GameElement.GRASS:
                    return 0x008000; // Green
                case colorMapping_4.GameElement.WATER:
                    return 0x0000FF; // Blue
                case colorMapping_4.GameElement.FIRE:
                    return 0xFF4500; // Orange-Red
                case colorMapping_4.GameElement.PLAYER_START:
                    return 0xFFFF00; // Yellow
                case colorMapping_4.GameElement.DANGER:
                    return 0xFF0000; // Red
                default:
                    return 0xFFFFFF; // White fallback
            }
        }
        function getSpritePath(element) {
            switch (element) {
                case colorMapping_4.GameElement.ENEMY:
                    return proceduralSprites_1.generateProceduralSprite('enemy');
                case colorMapping_4.GameElement.DANGER:
                    return proceduralSprites_1.generateProceduralSprite('danger');
                case colorMapping_4.GameElement.PLAYER_FINISH:
                    return proceduralSprites_1.generateProceduralSprite('finish');
                case colorMapping_4.GameElement.TREASURE:
                    return proceduralSprites_1.generateProceduralSprite('treasure');
                case colorMapping_4.GameElement.KEY:
                    return proceduralSprites_1.generateProceduralSprite('key');
                case colorMapping_4.GameElement.DOOR:
                    return proceduralSprites_1.generateProceduralSprite('door');
                case colorMapping_4.GameElement.STAIRS:
                    return proceduralSprites_1.generateProceduralSprite('stairs');
                case colorMapping_4.GameElement.FIRE:
                    return proceduralSprites_1.generateProceduralSprite('fire');
                case colorMapping_4.GameElement.GRASS:
                    return proceduralSprites_1.generateProceduralSprite('grass');
                case colorMapping_4.GameElement.WATER:
                    return proceduralSprites_1.generateProceduralSprite('water');
                case colorMapping_4.GameElement.PLAYER_START:
                    return null; // Will create colored quad instead
                default:
                    return null;
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
            // Debug mode toggle
            if (keysPressed.has('keyg')) {
                debugMode = !debugMode;
                console.log(`${debugMode ? '🔧 DEBUG MODE ENABLED' : '🔧 DEBUG MODE DISABLED'}`);
                if (debugMode) {
                    console.log('Debug features:');
                    console.log('- Red wireframes show wall boundaries');
                    console.log('- Colored spheres show collision points');
                    console.log('- Console logs show collision detection details');
                    console.log('- Press G again to disable debug mode');
                    // Reset debug tracking
                    window.lastDebugPosition = null;
                    // Recreate debug visualization
                    createDebugSpheres();
                }
                else {
                    // Reset debug tracking
                    window.lastDebugPosition = null;
                    // Clear debug visualization
                    createDebugSpheres();
                }
                // Remove debug mode key from pressed keys to prevent continuous toggling
                keysPressed.delete('keyg');
            }
            // Mouse look rotation (if pointer is locked)
            if (isPointerLocked) {
                player.angle += mouseX * 0.002;
                mouseX = 0; // Reset mouse movement
            }
            // Jump input
            if (keysPressed.has('space')) {
                // Only allow jump if near ground level (not already in air)
                if (Math.abs(playerVerticalVel) < 0.001) {
                    playerVerticalVel = JUMP_VELOCITY;
                }
                keysPressed.delete('space');
            }
            // Water slow and swimming bobbing
            const tileX = Math.floor(newX);
            const tileY = Math.floor(newY);
            const inBounds = tileY >= 0 && tileY < currentGameMap.length && tileX >= 0 && tileX < currentGameMap[0].length;
            const inWater = inBounds && currentGameMap[tileY][tileX] === colorMapping_4.GameElement.WATER;
            const speedMultiplier = inWater ? 0.55 : 1.0;
            const groundH = terrain_1.sampleHeightBilinear(heightMap, newX, newY);
            const waterDepth = inWater ? Math.max(0, (0.0 - groundH) + 0.35) : 0;
            // Check collision and update position with speed multiplier
            const prevX = player.x;
            const prevY = player.y;
            if (isValidPosition(newX, newY)) {
                player.x += (newX - player.x) * speedMultiplier;
                player.y += (newY - player.y) * speedMultiplier;
            }
            else {
                // Try to slide along walls if direct movement is blocked
                trySlideAlongWalls(newX, newY);
            }
            // Update camera position with swim bob and terrain height
            // Vertical physics
            let baseEye = 1 + groundH; // baseline eye height following terrain
            if (inWater) {
                // Buoyancy counteracts gravity
                const buoyancyForce = Math.min(0.015, waterDepth * 0.02);
                playerVerticalVel += buoyancyForce;
                playerVerticalVel *= 0.96; // water drag
            }
            else {
                playerVerticalVel += GRAVITY;
            }
            // Simulate vertical position of the camera relative to baseEye
            baseEye += playerVerticalVel;
            // Prevent sinking below terrain more than STEP_MAX unless in water
            if (!inWater && baseEye < 1 + groundH - STEP_MAX) {
                baseEye = 1 + groundH - STEP_MAX;
                playerVerticalVel = 0;
            }
            const swimBob = inWater ? (Math.sin(Date.now() * 0.006) * 0.08) : 0;
            camera.position.set(player.x, baseEye + swimBob, player.y);
            const lookX = player.x + Math.cos(player.angle) * 2;
            const lookZ = player.y + Math.sin(player.angle) * 2;
            camera.lookAt(lookX, groundH + 1, lookZ);
            // Update player torch position and add subtle flicker
            if (scene.playerTorch) {
                const torch = scene.playerTorch;
                torch.position.set(player.x, 1.5, player.y);
                const t = Date.now() * 0.002;
                torch.intensity = 2.0 + Math.sin(t * 3.2) * 0.2 + Math.sin(t * 5.7) * 0.1;
            }
            // Particle-based splashes and dust removed
        }
        // Particle splash removed
        // Dust puff removed
        // Simple WebAudio splash synth
        function playSplashSound() {
            try {
                const ctx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                window.audioCtx = ctx;
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'triangle';
                o.frequency.setValueAtTime(600, ctx.currentTime);
                o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);
                g.gain.setValueAtTime(0.15, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
                o.connect(g).connect(ctx.destination);
                o.start();
                o.stop(ctx.currentTime + 0.4);
            }
            catch { }
        }
        function isValidPosition(x, y) {
            // Debug logging for collision detection calls (only for first call per frame to reduce spam)
            if (debugMode && (!window.lastDebugPosition || window.lastDebugPosition !== `${x.toFixed(3)},${y.toFixed(3)}`)) {
                console.log(`🔍 Checking position: (${x.toFixed(3)}, ${y.toFixed(3)})`);
                console.log(`   Player collision radius: ${PLAYER_COLLISION_RADIUS}`);
                window.lastDebugPosition = `${x.toFixed(3)},${y.toFixed(3)}`;
            }
            // Check bounds first with a small buffer
            const buffer = 0.05;
            if (x < buffer || x >= currentGameMap[0].length - buffer ||
                y < buffer || y >= currentGameMap.length - buffer) {
                if (debugMode) {
                    console.log(`❌ OUT OF BOUNDS: Position (${x.toFixed(3)}, ${y.toFixed(3)}) outside map bounds`);
                }
                return false;
            }
            // If walls are disabled, only enforce bounds
            if (DISABLE_WALLS) {
                return true;
            }
            // Use comprehensive collision points for reliable wall detection
            // Points are arranged in a circle plus diagonals for better coverage
            const collisionPoints = [
                { x: x, y: y, name: 'Center' }, // Center
                { x: x + PLAYER_COLLISION_RADIUS * 0.7, y: y, name: 'Right' },
                { x: x - PLAYER_COLLISION_RADIUS * 0.7, y: y, name: 'Left' },
                { x: x, y: y + PLAYER_COLLISION_RADIUS * 0.7, name: 'Front' },
                { x: x, y: y - PLAYER_COLLISION_RADIUS * 0.7, name: 'Back' },
                { x: x + PLAYER_COLLISION_RADIUS * 0.5, y: y + PLAYER_COLLISION_RADIUS * 0.5, name: 'Front-Right' },
                { x: x - PLAYER_COLLISION_RADIUS * 0.5, y: y + PLAYER_COLLISION_RADIUS * 0.5, name: 'Front-Left' },
                { x: x + PLAYER_COLLISION_RADIUS * 0.5, y: y - PLAYER_COLLISION_RADIUS * 0.5, name: 'Back-Right' },
                { x: x - PLAYER_COLLISION_RADIUS * 0.5, y: y - PLAYER_COLLISION_RADIUS * 0.5, name: 'Back-Left' },
            ];
            // Debug: Log collision points
            if (debugMode && (!window.lastDebugPosition || window.lastDebugPosition !== `${x.toFixed(3)},${y.toFixed(3)}`)) {
                console.log('   Collision points:');
                collisionPoints.forEach((point, index) => {
                    console.log(`     ${point.name}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)})`);
                });
            }
            // Check all collision points
            for (const point of collisionPoints) {
                // Get the grid cell this point is in
                const gridX = Math.floor(point.x);
                const gridY = Math.floor(point.y);
                // Check the current cell and all 8 adjacent cells
                // This ensures we catch walls even when the player is near cell boundaries
                const cellsToCheck = [
                    { x: gridX, y: gridY }, // Current cell
                    { x: gridX + 1, y: gridY }, // Right
                    { x: gridX - 1, y: gridY }, // Left
                    { x: gridX, y: gridY + 1 }, // Front
                    { x: gridX, y: gridY - 1 }, // Back
                    { x: gridX + 1, y: gridY + 1 }, // Front-Right
                    { x: gridX + 1, y: gridY - 1 }, // Back-Right
                    { x: gridX - 1, y: gridY + 1 }, // Front-Left
                    { x: gridX - 1, y: gridY - 1 }, // Back-Left
                ];
                // Filter to valid grid cells only
                const validCells = cellsToCheck.filter(cell => cell.x >= 0 && cell.x < currentGameMap[0].length &&
                    cell.y >= 0 && cell.y < currentGameMap.length);
                // Check each valid cell for walls
                for (const cell of validCells) {
                    const element = currentGameMap[cell.y][cell.x];
                    const properties = colorMapping_4.getElementProperties(element);
                    if (!properties.walkable) {
                        // Check if the collision point is within this wall's 3D bounding box
                        // Wall occupies: [cell.x - 0.5, cell.x + 0.5] x [0, WALL_HEIGHT] x [cell.y - 0.5, cell.y + 0.5]
                        const wallMinX = cell.x - 0.5;
                        const wallMaxX = cell.x + 0.5;
                        const wallMinY = cell.y - 0.5;
                        const wallMaxY = cell.y + 0.5;
                        // Use strict inequalities to avoid edge case issues
                        // Allow a tiny tolerance for floating point precision
                        const tolerance = 0.02; // Relaxed tolerance so corridors don't block movement
                        if (point.x > wallMinX + tolerance && point.x < wallMaxX - tolerance &&
                            point.y > wallMinY + tolerance && point.y < wallMaxY - tolerance) {
                            // Debug logging for collision detection
                            if (debugMode) {
                                console.log(`🔴 COLLISION: ${point.name} point (${point.x.toFixed(3)}, ${point.y.toFixed(3)}) inside wall at cell (${cell.x}, ${cell.y})`);
                                console.log(`   Wall bounds: X[${wallMinX.toFixed(3)}, ${wallMaxX.toFixed(3)}] Y[${wallMinY.toFixed(3)}, ${wallMaxY.toFixed(3)}]`);
                                console.log(`   Player position: (${player.x.toFixed(3)}, ${player.y.toFixed(3)})`);
                                console.log(`   Distance from player: dx=${(point.x - player.x).toFixed(3)}, dy=${(point.y - player.y).toFixed(3)})`);
                            }
                            return false;
                        }
                    }
                }
            }
            // Debug logging for successful position validation
            if (debugMode) {
                console.log(`✅ POSITION VALID: (${x.toFixed(3)}, ${y.toFixed(3)})`);
            }
            return true;
        }
        // Exposed hook to trigger enemy hit sparks (call externally when an enemy is damaged)
        window.spawnHitSparks = function (worldX, worldY) { };
        function trySlideAlongWalls(targetX, targetY) {
            const currentX = player.x;
            const currentY = player.y;
            // Calculate movement vector and normalize it
            const deltaX = targetX - currentX;
            const deltaY = targetY - currentY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            if (distance === 0)
                return; // No movement attempted
            const normalizedDeltaX = deltaX / distance;
            const normalizedDeltaY = deltaY / distance;
            // Maximum distance to attempt sliding
            const maxSlideDistance = PLAYER_COLLISION_RADIUS * 0.8;
            const slideStep = 0.03; // Smaller step for finer control
            if (debugMode) {
                console.log(`🎯 Attempting to slide from (${currentX.toFixed(3)}, ${currentY.toFixed(3)}) towards (${targetX.toFixed(3)}, ${targetY.toFixed(3)})`);
                console.log(`   Movement vector: (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)}) distance: ${distance.toFixed(3)}`);
            }
            // Try sliding perpendicular to the movement direction
            // This creates a "sliding" effect along walls
            const perpendicularX = -normalizedDeltaY;
            const perpendicularY = normalizedDeltaX;
            // Try both directions perpendicular to movement
            const slideDirections = [
                { x: perpendicularX, y: perpendicularY, name: 'Perpendicular +' },
                { x: -perpendicularX, y: -perpendicularY, name: 'Perpendicular -' },
                { x: normalizedDeltaX * 0.5, y: normalizedDeltaY * 0.5, name: 'Forward Half' },
                { x: perpendicularX * 0.7, y: perpendicularY * 0.7, name: 'Perp 70%' },
                { x: -perpendicularX * 0.7, y: -perpendicularY * 0.7, name: 'Perp -70%' },
            ];
            // First try smaller slides for smoother movement
            for (let slideDist = slideStep; slideDist <= maxSlideDistance; slideDist += slideStep) {
                for (const dir of slideDirections) {
                    const testX = currentX + dir.x * slideDist;
                    const testY = currentY + dir.y * slideDist;
                    if (isValidPosition(testX, testY)) {
                        player.x = testX;
                        player.y = testY;
                        if (debugMode) {
                            console.log(`✅ SLID ${dir.name}: distance ${slideDist.toFixed(3)} to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
                        }
                        return;
                    }
                }
            }
            // If perpendicular sliding fails, try moving directly towards the target in smaller increments
            // This handles cases where we're trying to move into a corner or tight space
            const directSlideDirections = [
                { x: normalizedDeltaX, y: normalizedDeltaY, name: 'Direct' },
                { x: normalizedDeltaX * 0.3, y: normalizedDeltaY * 0.3, name: 'Direct 30%' },
                { x: normalizedDeltaX * 0.1, y: normalizedDeltaY * 0.1, name: 'Direct 10%' },
            ];
            for (let slideDist = slideStep; slideDist <= maxSlideDistance * 0.5; slideDist += slideStep) {
                for (const dir of directSlideDirections) {
                    const testX = currentX + dir.x * slideDist;
                    const testY = currentY + dir.y * slideDist;
                    if (isValidPosition(testX, testY)) {
                        player.x = testX;
                        player.y = testY;
                        if (debugMode) {
                            console.log(`✅ SLID ${dir.name}: distance ${slideDist.toFixed(3)} to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
                        }
                        return;
                    }
                }
            }
            // Last resort: try very small movements in cardinal directions
            const cardinalDirections = [
                { x: slideStep, y: 0, name: '→' },
                { x: -slideStep, y: 0, name: '←' },
                { x: 0, y: slideStep, name: '↑' },
                { x: 0, y: -slideStep, name: '↓' },
            ];
            for (const dir of cardinalDirections) {
                const testX = currentX + dir.x;
                const testY = currentY + dir.y;
                if (isValidPosition(testX, testY)) {
                    player.x = testX;
                    player.y = testY;
                    if (debugMode) {
                        console.log(`✅ MICRO-SLID ${dir.name}: to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
                    }
                    return;
                }
            }
            // If all sliding attempts fail, stay put
            if (debugMode) {
                console.log(`❌ CANNOT SLIDE: No valid positions found near (${currentX.toFixed(3)}, ${currentY.toFixed(3)})`);
                console.log(`   Target was: (${targetX.toFixed(3)}, ${targetY.toFixed(3)})`);
            }
        }
        function createDebugSpheres() {
            // Clear existing debug spheres
            debugSpheres.forEach(sphere => scene.remove(sphere));
            debugSpheres = [];
            // Clear existing wireframes when recreating debug spheres
            scene.children.forEach(child => {
                if (child.name && child.name.startsWith('wireframe_')) {
                    scene.remove(child);
                }
            });
            // Create debug spheres for collision points (9 points now)
            const sphereGeometry = new THREE.SphereGeometry(0.03, 8, 8);
            for (let i = 0; i < 9; i++) {
                const sphereMaterial = new THREE.MeshBasicMaterial({
                    color: i === 0 ? 0x00ff00 : i < 5 ? 0xff0000 : 0xffa500, // Green for center, red for cardinal, orange for diagonal
                    transparent: true,
                    opacity: 0.7
                });
                const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                sphere.visible = false; // Hidden by default
                scene.add(sphere);
                debugSpheres.push(sphere);
            }
            // Recreate wireframes for all walls if in debug mode
            if (debugMode) {
                for (let y = 0; y < currentGameMap.length; y++) {
                    for (let x = 0; x < currentGameMap[y].length; x++) {
                        const element = currentGameMap[y][x];
                        const properties = colorMapping_4.getElementProperties(element);
                        if (!properties.walkable) {
                            // Recreate wireframe for this wall
                            const wireframeGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
                            const wireframeMaterial = new THREE.MeshBasicMaterial({
                                color: 0xff0000,
                                wireframe: true,
                                transparent: true,
                                opacity: 0.3
                            });
                            const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
                            wireframe.position.set(x, WALL_HEIGHT / 2, y);
                            wireframe.name = `wireframe_${x}_${y}`;
                            scene.add(wireframe);
                        }
                    }
                }
            }
        }
        function updateDebugVisualization() {
            if (!debugMode || debugSpheres.length === 0) {
                debugSpheres.forEach(sphere => sphere.visible = false);
                return;
            }
            // Show collision points around player (9 points)
            const collisionPoints = [
                { x: player.x, y: player.y }, // Center
                { x: player.x + PLAYER_COLLISION_RADIUS * 0.7, y: player.y }, // Right
                { x: player.x - PLAYER_COLLISION_RADIUS * 0.7, y: player.y }, // Left
                { x: player.x, y: player.y + PLAYER_COLLISION_RADIUS * 0.7 }, // Front
                { x: player.x, y: player.y - PLAYER_COLLISION_RADIUS * 0.7 }, // Back
                { x: player.x + PLAYER_COLLISION_RADIUS * 0.5, y: player.y + PLAYER_COLLISION_RADIUS * 0.5 }, // Front-Right
                { x: player.x - PLAYER_COLLISION_RADIUS * 0.5, y: player.y + PLAYER_COLLISION_RADIUS * 0.5 }, // Front-Left
                { x: player.x + PLAYER_COLLISION_RADIUS * 0.5, y: player.y - PLAYER_COLLISION_RADIUS * 0.5 }, // Back-Right
                { x: player.x - PLAYER_COLLISION_RADIUS * 0.5, y: player.y - PLAYER_COLLISION_RADIUS * 0.5 }, // Back-Left
            ];
            collisionPoints.forEach((point, index) => {
                if (debugSpheres[index]) {
                    debugSpheres[index].position.set(point.x, 1.2, point.y);
                    debugSpheres[index].visible = true;
                    // Color based on collision status
                    const tileX = Math.floor(point.x);
                    const tileY = Math.floor(point.y);
                    if (tileX >= 0 && tileX < currentGameMap[0].length &&
                        tileY >= 0 && tileY < currentGameMap.length) {
                        const element = currentGameMap[tileY][tileX];
                        const properties = colorMapping_4.getElementProperties(element);
                        const material = debugSpheres[index].material;
                        material.color.setHex(properties.walkable ? 0x00ff00 : 0xff0000);
                    }
                }
            });
        }
        function gameLoop() {
            if (!gameRunning)
                return;
            updatePlayer();
            applyTileEffects();
            updateUI();
            drawMinimap();
            updateDebugVisualization();
            updateSpriteAnimations();
            updateSceneEffects();
            if (usePostprocessing && postRenderTarget && postMaterial) {
                // Render to low-res target, then upscale with post shader
                renderer.setRenderTarget(postRenderTarget);
                renderer.render(scene, camera);
                renderer.setRenderTarget(null);
                // Update shader time and ensure texture is current
                postMaterial.uniforms.time.value = Date.now() * 0.001;
                postMaterial.uniforms.tDiffuse.value = postRenderTarget.texture;
                renderer.render(postScene, postCamera);
            }
            else {
                // Fallback direct render
                renderer.render(scene, camera);
            }
            animationId = requestAnimationFrame(gameLoop);
        }
        function applyTileEffects() {
            const tileX = Math.floor(player.x);
            const tileY = Math.floor(player.y);
            if (tileX < 0 || tileY < 0 || tileY >= currentGameMap.length || tileX >= currentGameMap[0].length)
                return;
            const element = currentGameMap[tileY][tileX];
            // Fire and danger damage
            if (element === colorMapping_4.GameElement.FIRE || element === colorMapping_4.GameElement.DANGER) {
                changeHealth(-0.25); // damage per frame at ~60fps ~15 hp/s
            }
        }
        function updateUI() {
            // Draw pixelated health bar to HUD canvas
            if (!hudHealthCtx)
                return;
            const ctx = hudHealthCtx;
            const w = hudHealthCanvas.width;
            const h = hudHealthCanvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.imageSmoothingEnabled = false;
            // Frame
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, w - 2, h - 2);
            // Bar
            const pct = Math.max(0, Math.min(1, player.health / player.maxHealth));
            const barW = Math.floor((w - 6) * pct);
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, '#ff3b3b');
            grad.addColorStop(1, '#ff7a3b');
            ctx.fillStyle = grad;
            ctx.fillRect(3, 3, barW, h - 6);
            // Upload to texture
            hudHealthTexture.needsUpdate = true;
            // Water overlay update (underwater tint when in water tile)
            const tileX = Math.floor(player.x);
            const tileY = Math.floor(player.y);
            const inBounds = tileY >= 0 && tileY < currentGameMap.length && tileX >= 0 && tileX < currentGameMap[0].length;
            const inWater = inBounds && currentGameMap[tileY][tileX] === colorMapping_4.GameElement.WATER;
            const overlay = scene.waterOverlay;
            if (overlay && overlay.ctx) {
                const c = overlay.canvas;
                const octx = overlay.ctx;
                octx.clearRect(0, 0, c.width, c.height);
                if (inWater) {
                    octx.fillStyle = 'rgba(50,120,220,0.28)';
                    octx.fillRect(0, 0, c.width, c.height);
                }
                overlay.texture.needsUpdate = true;
                overlay.sprite.visible = inWater;
            }
        }
        function drawMinimap() {
            if (!hudMinimapCtx)
                return;
            const ctx = hudMinimapCtx;
            const w = hudMinimapCanvas.width;
            const h = hudMinimapCanvas.height;
            ctx.clearRect(0, 0, w, h);
            if (!currentGameMap.length)
                return;
            const cols = currentGameMap[0].length;
            const rows = currentGameMap.length;
            const cell = Math.min(Math.floor(w / cols), Math.floor(h / rows));
            const offsetX = Math.floor((w - cols * cell) / 2);
            const offsetY = Math.floor((h - rows * cell) / 2);
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const el = currentGameMap[y][x];
                    let color = '#2d2f3a';
                    switch (el) {
                        case colorMapping_4.GameElement.WALL:
                            color = '#555a66';
                            break;
                        case colorMapping_4.GameElement.WATER:
                            color = '#3a7bd9';
                            break;
                        case colorMapping_4.GameElement.GRASS:
                            color = '#3bbf6a';
                            break;
                        case colorMapping_4.GameElement.FIRE:
                            color = '#ff7a1a';
                            break;
                        case colorMapping_4.GameElement.DANGER:
                            color = '#ff3366';
                            break;
                        case colorMapping_4.GameElement.DOOR:
                            color = '#8e5a3c';
                            break;
                        case colorMapping_4.GameElement.STAIRS:
                            color = '#cfd3d6';
                            break;
                        default: color = '#2d2f3a';
                    }
                    ctx.fillStyle = color;
                    ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
                }
            }
            // Player
            ctx.fillStyle = '#ffffff';
            const px = offsetX + player.x * cell;
            const py = offsetY + player.y * cell;
            ctx.beginPath();
            ctx.arc(px, py, Math.max(2, cell * 0.18), 0, Math.PI * 2);
            ctx.fill();
            // Facing indicator
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, Math.floor(cell * 0.08));
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(player.angle) * cell * 0.5, py + Math.sin(player.angle) * cell * 0.5);
            ctx.stroke();
            // Enemies
            ctx.fillStyle = '#ff3366';
            enemies.forEach(e => {
                ctx.fillRect(offsetX + e.x * cell - 2, offsetY + e.y * cell - 2, 4, 4);
            });
            // Upload to texture
            hudMinimapTexture.needsUpdate = true;
        }
        function changeHealth(delta) {
            player.health = Math.max(0, Math.min(player.maxHealth, player.health + delta));
            if (player.health <= 0) {
                onGameOver();
            }
        }
        function onGameOver() {
            gameRunning = false;
            const overlay = document.createElement('div');
            overlay.style.position = 'absolute';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0,0,0,0.6)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.color = '#fff';
            overlay.style.fontFamily = 'sans-serif';
            overlay.style.fontSize = '28px';
            overlay.textContent = 'Game Over';
            uiContainer.appendChild(overlay);
        }
        function updateSpriteAnimations() {
            // Animate interactive elements with subtle floating motion
            const time = Date.now() * 0.001; // Convert to seconds
            scene.children.forEach(child => {
                if (child.userData && child.userData.originalY !== undefined && child.animate) {
                    const originalY = child.userData.originalY;
                    const amplitude = 0.05; // Subtle floating amplitude
                    const frequency = 2.0; // Floating speed
                    child.position.y = originalY + Math.sin(time * frequency) * amplitude;
                }
            });
            // Glow sprites removed
            // Glint shimmer
            glintSprites.forEach((s, idx) => {
                const base = 0.8 + Math.sin(time * 3.0 + s.phase) * 0.2;
                s.scale.set(base, base, 1);
                const mat = s.material;
                if (mat)
                    mat.opacity = 0.55 + Math.sin(time * 4.0 + s.phase) * 0.25;
            });
        }
        function isOccludedByWalls(targetX, targetY) {
            // DDA through grid from player to target center
            const startX = player.x;
            const startY = player.y;
            const endX = targetX + 0.0; // centers are integer already
            const endY = targetY + 0.0;
            const dx = endX - startX;
            const dy = endY - startY;
            const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 6; // higher sampling density
            if (steps <= 0)
                return false;
            const stepX = dx / steps;
            const stepY = dy / steps;
            let x = startX;
            let y = startY;
            for (let i = 0; i < steps; i++) {
                x += stepX;
                y += stepY;
                const gridX = Math.floor(x);
                const gridY = Math.floor(y);
                if (gridX === targetX && gridY === targetY) {
                    return false; // reached target cell without hitting another wall
                }
                if (gridX < 0 || gridY < 0 || gridY >= currentGameMap.length || gridX >= currentGameMap[0].length) {
                    return true; // outside map considered blocked
                }
                const element = currentGameMap[gridY][gridX];
                const properties = colorMapping_4.getElementProperties(element);
                if (!properties.walkable) {
                    // Hit a wall before reaching target
                    return true;
                }
            }
            return false;
        }
        function updateVisibility() {
            // Disabled: rely on distance fog for fading at ~20m; no manual culling
            return;
        }
        function ensureSpawnAccessible() {
            if (isValidPosition(player.x, player.y))
                return;
            // Search outward for first walkable tile
            const maxRadius = 5;
            for (let r = 1; r <= maxRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const tx = Math.floor(player.x) + dx;
                        const ty = Math.floor(player.y) + dy;
                        if (ty >= 0 && ty < currentGameMap.length && tx >= 0 && tx < currentGameMap[0].length) {
                            const properties = colorMapping_4.getElementProperties(currentGameMap[ty][tx]);
                            if (properties.walkable) {
                                const nx = tx + 0.5;
                                const ny = ty + 0.5;
                                if (isValidPosition(nx, ny)) {
                                    player.x = nx;
                                    player.y = ny;
                                    camera.position.set(player.x, 1, player.y);
                                    if (scene.playerTorch) {
                                        scene.playerTorch.position.set(player.x, 1.5, player.y);
                                    }
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        // Input handling
        function handleKeyDown(e) {
            keysPressed.add(e.code.toLowerCase());
            const k = (e.key || '').toLowerCase();
            switch (k) {
                case 'w':
                    keysPressed.add('keyw');
                    break;
                case 'a':
                    keysPressed.add('keya');
                    break;
                case 's':
                    keysPressed.add('keys');
                    break;
                case 'd':
                    keysPressed.add('keyd');
                    break;
                case 'arrowup':
                    keysPressed.add('arrowup');
                    break;
                case 'arrowdown':
                    keysPressed.add('arrowdown');
                    break;
                case 'arrowleft':
                    keysPressed.add('arrowleft');
                    break;
                case 'arrowright':
                    keysPressed.add('arrowright');
                    break;
                case 'q':
                    keysPressed.add('keyq');
                    break;
                case 'e':
                    keysPressed.add('keye');
                    break;
                case ' ':
                    keysPressed.add('space');
                    break;
            }
        }
        function handleKeyUp(e) {
            keysPressed.delete(e.code.toLowerCase());
            const k = (e.key || '').toLowerCase();
            switch (k) {
                case 'w':
                    keysPressed.delete('keyw');
                    break;
                case 'a':
                    keysPressed.delete('keya');
                    break;
                case 's':
                    keysPressed.delete('keys');
                    break;
                case 'd':
                    keysPressed.delete('keyd');
                    break;
                case 'arrowup':
                    keysPressed.delete('arrowup');
                    break;
                case 'arrowdown':
                    keysPressed.delete('arrowdown');
                    break;
                case 'arrowleft':
                    keysPressed.delete('arrowleft');
                    break;
                case 'arrowright':
                    keysPressed.delete('arrowright');
                    break;
                case 'q':
                    keysPressed.delete('keyq');
                    break;
                case 'e':
                    keysPressed.delete('keye');
                    break;
                case ' ':
                    keysPressed.delete('space');
                    break;
            }
        }
        // Mouse event handlers
        function handleMouseMove(e) {
            if (isPointerLocked) {
                mouseX += e.movementX;
            }
        }
        function handlePointerLockChange() {
            isPointerLocked = (document.pointerLockElement === renderer.domElement);
        }
        function handleClick() {
            if (!isPointerLocked) {
                renderer.domElement.requestPointerLock();
            }
        }
        function setupInputListeners() {
            // Event listeners
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('keyup', handleKeyUp);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('pointerlockchange', handlePointerLockChange);
            renderer.domElement.addEventListener('click', handleClick);
        }
        function updatePostHud() {
            if (!postHud || !postMaterial)
                return;
            const mode = postMaterial.uniforms.paletteMode.value;
            const modeName = mode === 0 ? 'None' : mode === 1 ? 'GameBoy' : mode === 2 ? 'CRT' : 'Retro16';
            postHud.textContent = `Post: ${usePostprocessing ? 'ON' : 'OFF'} | Palette: ${modeName} (1-4) | Toggle Post: P`;
            if (paletteSelect)
                paletteSelect.value = String(mode);
        }
        return component;
    }
    exports_24("createThreeJSDungeonCrawler", createThreeJSDungeonCrawler);
    return {
        setters: [
            function (colorMapping_4_1) {
                colorMapping_4 = colorMapping_4_1;
            },
            function (terrain_1_1) {
                terrain_1 = terrain_1_1;
            },
            function (gameSettings_2_1) {
                gameSettings_2 = gameSettings_2_1;
            },
            function (proceduralSprites_1_1) {
                proceduralSprites_1 = proceduralSprites_1_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/imageUploader", ["getImageData", "util", "components/common"], function (exports_25, context_25) {
    "use strict";
    var getImageData_2, util_6, common_5;
    var __moduleName = context_25 && context_25.id;
    function createImageUploader() {
        const component = {
            domElement: Object.assign(document.createElement("div"), { className: "imageUploaderComponent" }),
            getCurrentImage: () => currentImageData,
            clear: () => {
                // Clear the file input
                fileInput.value = '';
                heightFileInput.value = '';
                // Clear the preview
                previewImage.src = '';
                previewImage.style.display = 'none';
                heightPreviewImage.src = '';
                heightPreviewImage.style.display = 'none';
                // Clear stored image data
                currentImageData = null;
                currentHeightmap = null;
                // Disable the use button
                useImageButton.disabled = true;
                // Clear any status message
                statusMessage.textContent = '';
                statusMessage.style.display = 'none';
            }
        };
        // Current uploaded image data
        let currentImageData = null;
        let currentHeightmap = null;
        // Create UI elements
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.marginBottom = "10px";
        const heightFileInput = document.createElement("input");
        heightFileInput.type = "file";
        heightFileInput.accept = "image/*";
        heightFileInput.style.marginBottom = "10px";
        const previewImage = document.createElement("img");
        previewImage.className = "uploadPreview";
        previewImage.style.display = "none";
        previewImage.style.maxWidth = "300px";
        previewImage.style.maxHeight = "300px";
        previewImage.style.border = "1px solid #ccc";
        previewImage.style.marginTop = "10px";
        const heightPreviewImage = document.createElement("img");
        heightPreviewImage.className = "uploadPreview";
        heightPreviewImage.style.display = "none";
        heightPreviewImage.style.maxWidth = "300px";
        heightPreviewImage.style.maxHeight = "300px";
        heightPreviewImage.style.border = "1px solid #ccc";
        heightPreviewImage.style.marginTop = "10px";
        const statusMessage = document.createElement("p");
        statusMessage.style.display = "none";
        statusMessage.style.marginTop = "10px";
        statusMessage.style.padding = "8px";
        statusMessage.style.borderRadius = "4px";
        const useImageButton = document.createElement("input");
        useImageButton.type = "button";
        useImageButton.value = "Use This Map";
        useImageButton.disabled = true;
        useImageButton.style.marginTop = "10px";
        useImageButton.onclick = () => {
            if (currentImageData && component.onUploadComplete) {
                const payload = currentImageData;
                payload.__heightmap = currentHeightmap || null;
                component.onUploadComplete(payload);
            }
        };
        const clearButton = document.createElement("input");
        clearButton.type = "button";
        clearButton.value = "Clear";
        clearButton.style.marginTop = "10px";
        clearButton.onclick = component.clear;
        // File input change handler
        fileInput.onchange = async () => {
            if (!fileInput.files || fileInput.files.length === 0) {
                return;
            }
            const file = fileInput.files[0];
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showStatusMessage('Please select a valid image file.', 'error');
                return;
            }
            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                showStatusMessage('File size too large. Please select an image smaller than 10MB.', 'error');
                return;
            }
            try {
                showStatusMessage('Processing image...', 'info');
                // Create object URL for preview
                const objectUrl = URL.createObjectURL(file);
                // Load image data using existing utility
                const imageData = await getImageData_2.default(objectUrl);
                // Check dimensions (reasonable limits for dungeon maps)
                const maxDimension = 256;
                if (imageData.width > maxDimension || imageData.height > maxDimension) {
                    showStatusMessage(`Image dimensions too large. Please use an image no larger than ${maxDimension}x${maxDimension} pixels.`, 'error');
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                // Success - store image data and update UI
                currentImageData = imageData;
                previewImage.src = objectUrl;
                previewImage.style.display = '';
                useImageButton.disabled = false;
                showStatusMessage(`Image loaded successfully: ${imageData.width}x${imageData.height} pixels`, 'success');
                // Clean up object URL after image loads
                previewImage.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                };
            }
            catch (error) {
                console.error('Error loading image:', error);
                showStatusMessage('Error loading image. Please try a different file.', 'error');
            }
        };
        heightFileInput.onchange = async () => {
            if (!heightFileInput.files || heightFileInput.files.length === 0)
                return;
            const file = heightFileInput.files[0];
            if (!file.type.startsWith('image/')) {
                showStatusMessage('Please select a valid heightmap image file.', 'error');
                return;
            }
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                showStatusMessage('Heightmap too large. < 10MB please.', 'error');
                return;
            }
            try {
                const objectUrl = URL.createObjectURL(file);
                const imageData = await getImageData_2.default(objectUrl);
                if (currentImageData && (imageData.width !== currentImageData.width || imageData.height !== currentImageData.height)) {
                    showStatusMessage('Heightmap size must match the main map size.', 'error');
                    URL.revokeObjectURL(objectUrl);
                    return;
                }
                currentHeightmap = imageData;
                heightPreviewImage.src = objectUrl;
                heightPreviewImage.style.display = '';
                showStatusMessage(`Heightmap loaded: ${imageData.width}x${imageData.height}`, 'success');
                heightPreviewImage.onload = () => URL.revokeObjectURL(objectUrl);
            }
            catch (e) {
                console.error(e);
                showStatusMessage('Error loading heightmap image.', 'error');
            }
        };
        function showStatusMessage(message, type) {
            statusMessage.textContent = message;
            statusMessage.style.display = 'block';
            // Remove existing classes
            statusMessage.classList.remove('status-success', 'status-error', 'status-info');
            // Add appropriate class for styling
            statusMessage.classList.add(`status-${type}`);
            // Style based on type
            switch (type) {
                case 'success':
                    statusMessage.style.backgroundColor = '#d4edda';
                    statusMessage.style.color = '#155724';
                    statusMessage.style.border = '1px solid #c3e6cb';
                    break;
                case 'error':
                    statusMessage.style.backgroundColor = '#f8d7da';
                    statusMessage.style.color = '#721c24';
                    statusMessage.style.border = '1px solid #f5c6cb';
                    break;
                case 'info':
                    statusMessage.style.backgroundColor = '#d1ecf1';
                    statusMessage.style.color = '#0c5460';
                    statusMessage.style.border = '1px solid #bee5eb';
                    break;
            }
        }
        // Build the component DOM
        util_6.buildDomTree(component.domElement, [
            document.createElement("p"), [
                "Upload an existing map image to use directly as a dungeon. The image should be a simple pixel art map with distinct colors representing different terrain types."
            ],
            common_5.inputGroup(), [
                document.createElement("label"), [
                    "Select Image File: ", fileInput
                ]
            ],
            common_5.inputGroup(), [
                document.createElement("label"), [
                    "Optional Heightmap: ", heightFileInput
                ]
            ],
            statusMessage,
            previewImage,
            heightPreviewImage,
            common_5.inputGroup(), [
                useImageButton,
                clearButton
            ]
        ]);
        return component;
    }
    exports_25("createImageUploader", createImageUploader);
    return {
        setters: [
            function (getImageData_2_1) {
                getImageData_2 = getImageData_2_1;
            },
            function (util_6_1) {
                util_6 = util_6_1;
            },
            function (common_5_1) {
                common_5 = common_5_1;
            }
        ],
        execute: function () {
        }
    };
});
System.register("components/assetManager", ["gameSettings"], function (exports_26, context_26) {
    "use strict";
    var gameSettings_3, SPRITES, TEXTURES;
    var __moduleName = context_26 && context_26.id;
    function createAssetManager() {
        const el = Object.assign(document.createElement('div'), { className: 'assetManager card' });
        const title = document.createElement('h5');
        title.textContent = 'Assets';
        title.className = 'mb-3';
        el.appendChild(title);
        const grid = document.createElement('div');
        grid.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3';
        el.appendChild(grid);
        function addUploader(name, kind) {
            const col = document.createElement('div');
            col.className = 'col';
            const card = document.createElement('div');
            card.className = 'p-3 rounded-3 bg-dark border border-secondary';
            const label = document.createElement('div');
            label.className = 'text-secondary small mb-2';
            label.textContent = `${kind.toUpperCase()}: ${name}`;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.className = 'form-control form-control-sm';
            input.onchange = () => {
                const f = input.files && input.files[0];
                if (!f)
                    return;
                const url = URL.createObjectURL(f);
                if (kind === 'sprite')
                    gameSettings_3.setSpriteOverride(name, url);
                else
                    gameSettings_3.setTextureOverride(name, url);
                const preview = card.querySelector('img');
                if (preview)
                    preview.src = url;
            };
            const preview = document.createElement('img');
            preview.className = 'img-fluid rounded mt-2';
            preview.style.maxHeight = '80px';
            card.appendChild(label);
            card.appendChild(input);
            card.appendChild(preview);
            col.appendChild(card);
            grid.appendChild(col);
        }
        SPRITES.forEach(n => addUploader(n, 'sprite'));
        TEXTURES.forEach(n => addUploader(n, 'texture'));
        const save = document.createElement('button');
        save.textContent = 'Save to Browser';
        save.className = 'btn btn-success mt-3';
        save.onclick = () => {
            const s = gameSettings_3.getSettings();
            const serialized = {
                sprites: Array.from(s.spriteOverrides.entries()),
                textures: Array.from(s.textureOverrides.entries())
            };
            localStorage.setItem('wfc-assets', JSON.stringify(serialized));
            save.textContent = 'Saved ✓';
            setTimeout(() => save.textContent = 'Save to Browser', 1200);
        };
        el.appendChild(save);
        const load = document.createElement('button');
        load.textContent = 'Load from Browser';
        load.className = 'btn btn-secondary mt-3 ms-2';
        load.onclick = () => {
            const raw = localStorage.getItem('wfc-assets');
            if (!raw)
                return;
            const parsed = JSON.parse(raw);
            if (parsed.sprites)
                parsed.sprites.forEach(([k, v]) => gameSettings_3.setSpriteOverride(k, v));
            if (parsed.textures)
                parsed.textures.forEach(([k, v]) => gameSettings_3.setTextureOverride(k, v));
        };
        el.appendChild(load);
        return { domElement: el };
    }
    exports_26("createAssetManager", createAssetManager);
    return {
        setters: [
            function (gameSettings_3_1) {
                gameSettings_3 = gameSettings_3_1;
            }
        ],
        execute: function () {
            SPRITES = ['enemy', 'danger', 'finish', 'treasure', 'key', 'door', 'stairs', 'blade', 'fire', 'water', 'grass'];
            TEXTURES = ['wall_brick', 'wall_stone', 'floor_stone', 'ceiling_stone', 'water_texture', 'grass_texture', 'danger_texture', 'fire_texture', 'wood_texture', 'metal_texture'];
        }
    };
});
System.register("main", ["wfc/run", "util", "components/wfcOptions", "components/settingsPanel", "gameSettings", "components/presetPicker", "components/drawingCanvas", "components/imageEditor", "components/threeJSDungeonCrawler", "components/imageUploader", "components/assetManager", "colorMapping"], function (exports_27, context_27) {
    "use strict";
    var run_1, util_7, wfcOptions_1, settingsPanel_1, gameSettings_4, presetPicker_1, drawingCanvas_1, imageEditor_1, threeJSDungeonCrawler_1, imageUploader_1, assetManager_1, colorMapping_5, wfc, AppMode, currentMode, generatedImageData, gameMap, canvas, wfcOptions, inputBitmap, downloadButton, editImageButton, startWFC, modeTabContainer, inputModeTab, wfcModeTab, editModeTab, gameModeTab, contentContainer, settingsPanel, inputTabContainer, presetTab, drawTab, uploadTab, inputContainer, presetPicker, drawingCanvas, imageUploader, imageEditor, dungeonCrawler, mainElem;
    var __moduleName = context_27 && context_27.id;
    // Tab switching logic for input tabs
    function switchInputTab(activeTab, inactiveTabs, showElement) {
        // Remove active class from all tabs
        inactiveTabs.forEach(tab => tab.classList.remove("active"));
        activeTab.classList.add("active");
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
        const assetsBtn = document.createElement('button');
        assetsBtn.className = 'btn btn-secondary ms-2';
        assetsBtn.textContent = 'Assets';
        assetsBtn.onclick = () => {
            contentContainer.innerHTML = '';
            contentContainer.appendChild(settingsPanel.domElement);
            const assets = assetManager_1.createAssetManager();
            contentContainer.appendChild(assets.domElement);
        };
        util_7.buildDomTree(contentContainer, [
            settingsPanel.domElement,
            inputTabContainer, [
                presetTab,
                drawTab,
                uploadTab,
                assetsBtn,
            ],
            inputContainer,
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
        const actions = document.createElement("div");
        actions.className = "toolbar";
        util_7.buildDomTree(contentContainer, [
            settingsPanel.domElement,
            actions, [
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
        util_7.buildDomTree(contentContainer, [
            settingsPanel.domElement,
            document.createElement("p"), [
                "Use the drawing tools to add player start (dark green) and finish (dark red) points, polish routes, and adjust the dungeon layout."
            ],
            imageEditor.domElement,
        ]);
    }
    function buildDungeonCrawlerMode() {
        util_7.buildDomTree(contentContainer, [
            settingsPanel.domElement,
            dungeonCrawler.domElement,
        ]);
    }
    async function startDungeonCrawler() {
        if (!generatedImageData)
            return;
        // Convert image to game map
        gameMap = colorMapping_5.imageDataToGameMap(generatedImageData);
        // Derive height map in meters based on settings
        const s = gameSettings_4.getSettings();
        const payload = generatedImageData;
        const customHeight = payload.__heightmap;
        const { heights, lightnesses } = colorMapping_5.extractHslMaps(customHeight || generatedImageData);
        let heightOverride = heights;
        if (s.heightMode === 'procedural') {
            const h = generatedImageData.height;
            const w = generatedImageData.width;
            const freq = s.heightNoiseFrequency;
            const oct = s.heightNoiseOctaves;
            const scale = s.heightScaleMeters;
            const base = s.heightBaseMeters;
            const seed = s.heightSeed;
            const proc = generateProceduralHeightMap(w, h, { frequency: freq, octaves: oct, seed });
            // normalize 0..1 then scale
            let min = 1e9, max = -1e9;
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const v = proc[y][x];
                    if (v < min)
                        min = v;
                    if (v > max)
                        max = v;
                }
            }
            const range = Math.max(1e-6, max - min);
            heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const n = (proc[y][x] - min) / range; // 0..1
                    heightOverride[y][x] = base + n * scale;
                }
            }
            // Optional smoothing
            for (let p = 0; p < s.heightSmoothingPasses; p++) {
                heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
            }
            // Slope limiting and relaxation
            heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
        }
        else if (customHeight) {
            // If a custom heightmap was provided, use its lightness with scale/base; optionally quantize
            const scale = s.heightScaleMeters;
            const base = s.heightBaseMeters;
            const h = customHeight.height;
            const w = customHeight.width;
            heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
            if (s.heightMode === 'quantized') {
                const levels = Math.max(2, Math.floor(s.heightLevels));
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const l = lightnesses[y][x];
                        const idx = Math.round(l * (levels - 1));
                        const q = idx / (levels - 1);
                        heightOverride[y][x] = base + q * scale;
                    }
                }
            }
            else {
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const l = lightnesses[y][x];
                        heightOverride[y][x] = base + l * scale;
                    }
                }
            }
            // Smooth even with heightmap
            for (let p = 0; p < s.heightSmoothingPasses; p++) {
                heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
            }
            heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
        }
        else if (s.heightMode === 'quantized') {
            const levels = Math.max(2, Math.floor(s.heightLevels));
            const scale = s.heightScaleMeters;
            const base = s.heightBaseMeters;
            const h = generatedImageData.height;
            const w = generatedImageData.width;
            heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const l = lightnesses[y][x]; // 0..1
                    const idx = Math.round(l * (levels - 1));
                    const q = idx / (levels - 1);
                    heightOverride[y][x] = base + q * scale;
                }
            }
        }
        else if (s.heightMode === 'lightness') {
            const scale = s.heightScaleMeters;
            const base = s.heightBaseMeters;
            const h = generatedImageData.height;
            const w = generatedImageData.width;
            heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const l = lightnesses[y][x];
                    heightOverride[y][x] = base + l * scale;
                }
            }
        }
        // Final smoothing for non-procedural modes
        if (s.heightMode !== 'procedural') {
            for (let p = 0; p < s.heightSmoothingPasses; p++) {
                heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
            }
            heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
        }
        // Find player start position
        const playerStart = colorMapping_5.findPlayerStart(gameMap);
        if (!playerStart) {
            alert("No player start position found! Please add a dark green (#006400) pixel to mark the start.");
            switchMode(AppMode.IMAGE_EDITING);
            return;
        }
        // Find player finish position
        const playerFinish = colorMapping_5.findPlayerFinish(gameMap);
        if (!playerFinish) {
            alert("No player finish position found! Please add a dark red (#8B0000) pixel to mark the finish.");
            switchMode(AppMode.IMAGE_EDITING);
            return;
        }
        // Start the game
        try {
            await dungeonCrawler.startGame(gameMap, playerStart, heightOverride);
        }
        catch (error) {
            console.error('Failed to start game:', error);
        }
    }
    function generateProceduralHeightMap(width, height, opts) {
        // Simple fractal noise using the same noise from terrain.ts style
        const { frequency, octaves, seed } = opts;
        const rnd = mulberry32(seed);
        const noise2 = valueNoise2D(seed);
        const map = Array.from({ length: height }, () => new Array(width).fill(0));
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let amp = 1.0;
                let freq = frequency;
                let val = 0;
                let norm = 0;
                for (let o = 0; o < octaves; o++) {
                    val += noise2(x * 0.05 * freq, y * 0.05 * freq) * amp;
                    norm += amp;
                    amp *= 0.5;
                    freq *= 2.0;
                }
                map[y][x] = val / Math.max(1e-6, norm);
            }
        }
        return map;
    }
    function valueNoise2D(seed) {
        const rand = mulberry32(seed);
        const grid = new Map();
        function rnd(ix, iy) {
            const key = ix + ',' + iy;
            if (!grid.has(key))
                grid.set(key, rand());
            return grid.get(key);
        }
        function lerp(a, b, t) { return a + (b - a) * t; }
        function smoothstep(t) { return t * t * (3 - 2 * t); }
        return (x, y) => {
            const x0 = Math.floor(x), y0 = Math.floor(y);
            const tx = x - x0, ty = y - y0;
            const v00 = rnd(x0, y0);
            const v10 = rnd(x0 + 1, y0);
            const v01 = rnd(x0, y0 + 1);
            const v11 = rnd(x0 + 1, y0 + 1);
            const u = smoothstep(tx), v = smoothstep(ty);
            const a = lerp(v00, v10, u);
            const b = lerp(v01, v11, u);
            return lerp(a, b, v) * 2 - 1; // -1..1
        };
    }
    function mulberry32(a) {
        return function () {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function blurHeight(hm, radius) {
        if (radius <= 0)
            return hm;
        const rows = hm.length, cols = hm[0].length;
        const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
        const r = Math.max(1, radius);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let sum = 0, count = 0;
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = x + dx, ny = y + dy;
                        if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                            sum += hm[ny][nx];
                            count++;
                        }
                    }
                }
                out[y][x] = sum / Math.max(1, count);
            }
        }
        return out;
    }
    function gaussianKernel1D(radius) {
        const r = Math.max(1, radius);
        const sigma = r / 1.5;
        const k = [];
        let sum = 0;
        for (let i = -r; i <= r; i++) {
            const v = Math.exp(-(i * i) / (2 * sigma * sigma));
            k.push(v);
            sum += v;
        }
        return k.map(v => v / sum);
    }
    function gaussianBlurHeight(hm, radius) {
        if (radius <= 0)
            return hm;
        const rows = hm.length, cols = hm[0].length;
        const kr = Math.max(1, radius);
        const kernel = gaussianKernel1D(kr);
        // horizontal pass
        const temp = Array.from({ length: rows }, () => new Array(cols).fill(0));
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let sum = 0;
                for (let i = -kr; i <= kr; i++) {
                    const nx = Math.min(cols - 1, Math.max(0, x + i));
                    sum += hm[y][nx] * kernel[i + kr];
                }
                temp[y][x] = sum;
            }
        }
        // vertical pass
        const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let sum = 0;
                for (let i = -kr; i <= kr; i++) {
                    const ny = Math.min(rows - 1, Math.max(0, y + i));
                    sum += temp[ny][x] * kernel[i + kr];
                }
                out[y][x] = sum;
            }
        }
        return out;
    }
    function limitSlope(hm, maxSlopePerTile, relaxPasses) {
        if (maxSlopePerTile <= 0)
            return hm;
        const rows = hm.length, cols = hm[0].length;
        const out = hm.map(row => row.slice());
        for (let p = 0; p < Math.max(0, relaxPasses); p++) {
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const h0 = out[y][x];
                    let sum = h0, cnt = 1;
                    // 4-neighborhood
                    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
                    for (const [dx, dy] of nb) {
                        const nx = x + dx, ny = y + dy;
                        if (ny < 0 || ny >= rows || nx < 0 || nx >= cols)
                            continue;
                        const hN = out[ny][nx];
                        const diff = hN - h0;
                        if (Math.abs(diff) > maxSlopePerTile) {
                            const clamped = h0 + Math.sign(diff) * maxSlopePerTile;
                            sum += clamped;
                            cnt++;
                        }
                        else {
                            sum += hN;
                            cnt++;
                        }
                    }
                    out[y][x] = sum / cnt;
                }
            }
        }
        return out;
    }
    return {
        setters: [
            function (run_1_1) {
                run_1 = run_1_1;
            },
            function (util_7_1) {
                util_7 = util_7_1;
            },
            function (wfcOptions_1_1) {
                wfcOptions_1 = wfcOptions_1_1;
            },
            function (settingsPanel_1_1) {
                settingsPanel_1 = settingsPanel_1_1;
            },
            function (gameSettings_4_1) {
                gameSettings_4 = gameSettings_4_1;
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
            function (imageUploader_1_1) {
                imageUploader_1 = imageUploader_1_1;
            },
            function (assetManager_1_1) {
                assetManager_1 = assetManager_1_1;
            },
            function (colorMapping_5_1) {
                colorMapping_5 = colorMapping_5_1;
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
            // Global settings panel
            settingsPanel = settingsPanel_1.createSettingsPanel();
            // Input mode content
            inputTabContainer = document.createElement("div");
            inputTabContainer.className = "tabContainer";
            presetTab = document.createElement("button");
            presetTab.textContent = "Preset Images";
            presetTab.className = "tab active";
            drawTab = document.createElement("button");
            drawTab.textContent = "Draw Custom";
            drawTab.className = "tab";
            uploadTab = document.createElement("button");
            uploadTab.textContent = "Upload Map";
            uploadTab.className = "tab";
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
            // Image uploader for direct map upload
            imageUploader = imageUploader_1.createImageUploader();
            imageUploader.onUploadComplete = (image) => {
                // Store the uploaded image as generated image data
                generatedImageData = image;
                // Check if the uploaded map has required start/finish points
                const tempGameMap = colorMapping_5.imageDataToGameMap(image);
                const playerStart = colorMapping_5.findPlayerStart(tempGameMap);
                const playerFinish = colorMapping_5.findPlayerFinish(tempGameMap);
                if (!playerStart || !playerFinish) {
                    // Missing start or finish points - go to image editor first
                    const missingElements = [];
                    if (!playerStart)
                        missingElements.push("player start (dark green)");
                    if (!playerFinish)
                        missingElements.push("player finish (dark red)");
                    alert(`Your uploaded map is missing required elements: ${missingElements.join(" and ")}. Please use the image editor to add them before playing.`);
                    switchMode(AppMode.IMAGE_EDITING);
                }
                else {
                    // Map is complete - go directly to dungeon crawler
                    switchMode(AppMode.DUNGEON_CRAWLER);
                    startDungeonCrawler();
                }
            };
            // Image editor
            imageEditor = imageEditor_1.createImageEditor();
            imageEditor.domElement.classList.add('card');
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
            presetTab.onclick = () => switchInputTab(presetTab, [drawTab, uploadTab], presetPicker.domElement);
            drawTab.onclick = () => switchInputTab(drawTab, [presetTab, uploadTab], drawingCanvas.domElement);
            uploadTab.onclick = () => switchInputTab(uploadTab, [presetTab, drawTab], imageUploader.domElement);
            // Mode tab event listeners
            inputModeTab.onclick = () => switchMode(AppMode.INPUT);
            wfcModeTab.onclick = () => switchMode(AppMode.WFC_GENERATION);
            editModeTab.onclick = () => switchMode(AppMode.IMAGE_EDITING);
            gameModeTab.onclick = () => switchMode(AppMode.DUNGEON_CRAWLER);
            // Initialize the application
            mainElem = document.querySelector("main");
            if (mainElem) {
                util_7.buildDomTree(mainElem, [
                    modeTabContainer, [
                        inputModeTab,
                        wfcModeTab,
                        editModeTab,
                        gameModeTab,
                    ],
                    contentContainer,
                ]);
                // Start with input mode
                switchMode(AppMode.INPUT);
            }
        }
    };
});
