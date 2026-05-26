"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedMcpSnapshotTool = void 0;
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger("EnhancedMcpSnapshotTool");
class EnhancedMcpSnapshotTool {
    async capture(mcp, args = {}) {
        const perceptionQuestion = typeof args.perceptionQuestion === "string" ? args.perceptionQuestion : undefined;
        const { perceptionQuestion: _perceptionQuestion, ...mcpArgs } = args;
        const snapshotArgs = {
            ...mcpArgs,
            boxes: true,
        };
        const snapshot = await mcp.callTool("browser_snapshot", snapshotArgs);
        const context = await this.extractUiContext(mcp);
        const enhancedContext = context.context
            ? {
                ...context.context,
                sceneGraph: this.buildSceneGraph(context.context, snapshot.text, perceptionQuestion),
            }
            : undefined;
        return {
            text: this.buildEnhancedText(snapshot.text, enhancedContext, context.error, perceptionQuestion),
            rawSnapshotText: snapshot.text,
            context: enhancedContext,
            contextError: context.error,
            isError: snapshot.isError,
        };
    }
    async extractUiContext(mcp) {
        try {
            const result = await mcp.callTool("browser_run_code_unsafe", {
                code: this.getExtractionCode(),
            });
            if (result.isError) {
                return { error: result.text || "browser_run_code_unsafe failed." };
            }
            const context = this.parseContext(result.text);
            if (!context) {
                return { error: "Could not parse enhanced UI context from MCP result." };
            }
            return { context };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn("Enhanced UI context extraction failed:", message);
            return { error: message };
        }
    }
    parseContext(text) {
        const trimmed = text.trim();
        const candidates = [
            trimmed,
            this.extractFirstJsonObject(trimmed),
            this.extractJsonStringLiteral(trimmed),
        ].filter((candidate) => Boolean(candidate));
        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === "object" && parsed.url && parsed.viewport) {
                    return parsed;
                }
            }
            catch {
                // Try the next candidate.
            }
        }
        return undefined;
    }
    extractFirstJsonObject(text) {
        const start = text.indexOf("{");
        if (start < 0)
            return undefined;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
            const char = text[index];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (char === "{")
                depth += 1;
            if (char === "}") {
                depth -= 1;
                if (depth === 0)
                    return text.slice(start, index + 1);
            }
        }
        return undefined;
    }
    extractJsonStringLiteral(text) {
        try {
            const parsed = JSON.parse(text);
            return typeof parsed === "string" ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    buildEnhancedText(snapshotText, context, contextError, perceptionQuestion) {
        const sections = [
            "=== MCP ACCESSIBILITY SNAPSHOT WITH BOXES ===",
            snapshotText.slice(0, 36_000),
            "",
            "=== ENHANCED UI CONTEXT ===",
        ];
        if (context) {
            sections.push("", "=== UI ACTIVE SURFACE SUMMARY ===", JSON.stringify(this.buildSurfaceSummary(context), null, 2), "", "=== GENERIC PAGE MAP ===", JSON.stringify(this.buildGenericPageMap(context, perceptionQuestion), null, 2), "", "=== GENERIC SCENE GRAPH ===", JSON.stringify(context.sceneGraph, null, 2).slice(0, 24_000));
            logger.info("Enhanced UI context summary", {
                dialogs: context.dialogs.length,
                overlays: context.overlays.length,
                fields: context.fields.length,
                interactiveElements: context.interactiveElements.length,
                menusAndPopups: context.menusAndPopups.length,
                errorsAndAlerts: context.errorsAndAlerts.length,
                componentHints: context.componentHints.slice(0, 8),
            });
            sections.push("", "=== FULL ENHANCED UI CONTEXT ===", JSON.stringify(context, null, 2).slice(0, 18_000));
        }
        else {
            sections.push(JSON.stringify({
                available: false,
                error: contextError || "Enhanced UI context unavailable.",
            }, null, 2));
        }
        sections.push("", "=== USAGE NOTES ===", "- Use MCP refs from the accessibility snapshot for browser_click, browser_fill_form, browser_type, and related actions.", "- Use enhanced UI context to understand visible text, layout, dialogs, overlays, active/focused elements, validation errors, forms, custom widgets, and accessibility gaps.", "- If a candidate has no MCP ref but includes runtimeSelector, it is a live-session fallback selector injected by the observer and may be used for immediate browser actions.", "- runtimeSelector/data-ai-scene-id is transient perception metadata. Never write it into generated tests; test generation must prefer stable role/label/text/testid/user-facing locators.", "- If enhanced context shows visible UI that the MCP snapshot does not expose as refs, do not invent refs. Prefer runtimeSelector candidates, keyboard navigation, targeted vision, or another accessible path.");
        return sections.join("\n").slice(0, 60_000);
    }
    buildSurfaceSummary(context) {
        const activeSurfaces = [
            ...context.dialogs.map((item) => ({ kind: "dialog", ...item })),
            ...context.overlays.map((item) => ({ kind: "overlay", ...item })),
            ...context.menusAndPopups.map((item) => ({ kind: "menuOrPopup", ...item })),
        ].slice(0, 12);
        return {
            url: context.url,
            title: context.title,
            activeElement: context.activeElement,
            activeSurfaces,
            fields: context.fields.slice(0, 18),
            primaryControls: context.interactiveElements.slice(0, 24),
            errorsAndAlerts: context.errorsAndAlerts.slice(0, 10),
            tablesAndLists: context.tablesAndLists.slice(0, 8),
            componentHints: context.componentHints,
            accessibilityWarnings: context.accessibilityWarnings,
            note: "This summary is perception only. Use MCP refs from the accessibility snapshot for execution; if an active surface exists, interact inside it before background controls.",
        };
    }
    buildGenericPageMap(context, perceptionQuestion) {
        const graph = context.sceneGraph ?? this.buildSceneGraph(context, "", perceptionQuestion);
        const regions = graph.rankedRegions;
        const focusedRegion = regions.find((region) => region.priority === "active-surface") ||
            regions.find((region) => region.priority === "main-work-area") ||
            regions[0];
        return {
            purpose: "Generic multi-modal perception map. Use it to choose the relevant region before requesting deeper perception.",
            url: context.url,
            title: context.title,
            viewport: context.viewport,
            perceptionQuestion: perceptionQuestion ?? "No explicit observation contract question.",
            focusedRegion,
            regions,
            semanticSearch: graph.semanticSearch,
            observationContract: graph.observationContract,
            observationPolicy: [
                "Inspect the focused region first instead of increasing whole-page snapshot depth.",
                "If the desired element is not in the focused region, ask for a different region or screenshot vision.",
                "Use MCP refs first; when a visible candidate has no MCP ref, runtimeSelector is an immediate live-session fallback only.",
                "Do not infer executable MCP refs from this page map, and never persist runtimeSelector/data-ai-scene-id into generated tests.",
            ],
        };
    }
    buildSceneGraph(context, snapshotText, perceptionQuestion) {
        const mcpNodes = this.parseMcpSnapshotRefs(snapshotText);
        const nodes = this.buildSceneNodes(context, mcpNodes);
        const regions = this.buildRegionsFromNodes(context, nodes);
        const rankedRegions = this.rankRegions(regions, nodes, context, perceptionQuestion);
        const semanticSearch = this.buildSemanticSearch(nodes, perceptionQuestion);
        const observationContract = this.buildObservationContract(perceptionQuestion, semanticSearch, rankedRegions, context);
        return {
            perceptionQuestion,
            nodes: nodes.slice(0, 140),
            regions,
            rankedRegions: rankedRegions.slice(0, 8),
            semanticSearch,
            observationContract,
        };
    }
    parseMcpSnapshotRefs(snapshotText) {
        return snapshotText
            .split(/\r?\n/)
            .map((line) => {
            const ref = /\[ref=(e\d+)\]/.exec(line)?.[1];
            if (!ref)
                return undefined;
            const boxMatch = /\[box=(-?\d+),(-?\d+),(\d+),(\d+)\]/.exec(line);
            const quoted = /([a-zA-Z][\w-]*)\s+"([^"]+)"/.exec(line);
            const role = quoted?.[1] || /^\s*[-*]?\s*([a-zA-Z][\w-]*)/.exec(line)?.[1];
            const name = quoted?.[2];
            const value = /:\s*(.+)$/.exec(line)?.[1]?.trim();
            return {
                ref,
                role,
                name,
                text: value,
                bounds: boxMatch
                    ? {
                        x: Number(boxMatch[1]),
                        y: Number(boxMatch[2]),
                        width: Number(boxMatch[3]),
                        height: Number(boxMatch[4]),
                    }
                    : undefined,
            };
        })
            .filter((item) => Boolean(item))
            .slice(0, 400);
    }
    buildSceneNodes(context, mcpNodes) {
        const rawNodes = [
            ...context.dialogs,
            ...context.overlays,
            ...context.fields,
            ...context.interactiveElements,
            ...context.errorsAndAlerts,
            ...context.menusAndPopups,
            ...context.tablesAndLists,
        ];
        const unique = new Map();
        for (const node of rawNodes) {
            const key = [
                node.tagName,
                node.role,
                node.label,
                node.ariaLabel,
                node.text,
                node.value,
                node.bounds ? `${node.bounds.x},${node.bounds.y},${node.bounds.width},${node.bounds.height}` : "",
            ].join("|");
            if (!unique.has(key))
                unique.set(key, node);
        }
        return Array.from(unique.values())
            .slice(0, 240)
            .map((node, index) => {
            const sceneId = node.sceneId || `ui_${String(index + 1).padStart(4, "0")}`;
            const mcp = this.findBestMcpMatch(node, mcpNodes);
            const selector = node.selector ||
                (node.sceneId ? `[data-ai-scene-id="${node.sceneId}"]` : "");
            const rankText = [
                node.label,
                node.ariaLabel,
                node.text,
                node.placeholder,
                node.value,
                node.role,
                node.tagName,
                node.componentHints?.join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return {
                ...node,
                sceneId,
                selector,
                mcpRef: mcp?.ref,
                rankText,
                actions: this.inferActions(node),
                source: ["dom", mcp ? "mcp-accessibility" : ""].filter(Boolean),
            };
        });
    }
    findBestMcpMatch(node, mcpNodes) {
        let best;
        const nodeText = `${node.label || ""} ${node.ariaLabel || ""} ${node.text || ""} ${node.value || ""}`.toLowerCase();
        for (const item of mcpNodes) {
            let score = 0;
            if (node.bounds && item.bounds) {
                const distance = this.centerDistance(node.bounds, item.bounds);
                if (distance < 12)
                    score += 80;
                else if (distance < 30)
                    score += 45;
                else if (distance < 80)
                    score += 15;
            }
            const itemText = `${item.role || ""} ${item.name || ""} ${item.text || ""}`.toLowerCase();
            if (item.role && node.role && item.role.toLowerCase() === node.role.toLowerCase()) {
                score += 20;
            }
            if (item.name && nodeText.includes(item.name.toLowerCase()))
                score += 30;
            if (nodeText && itemText && this.tokenOverlap(nodeText, itemText) >= 0.45) {
                score += 20;
            }
            if (!best || score > best.score)
                best = { item, score };
        }
        return best && best.score >= 45 ? best.item : undefined;
    }
    centerDistance(a, b) {
        const ax = a.x + a.width / 2;
        const ay = a.y + a.height / 2;
        const bx = b.x + b.width / 2;
        const by = b.y + b.height / 2;
        return Math.hypot(ax - bx, ay - by);
    }
    tokenOverlap(a, b) {
        const left = new Set(a.split(/\W+/).filter((token) => token.length > 2));
        const right = new Set(b.split(/\W+/).filter((token) => token.length > 2));
        if (left.size === 0 || right.size === 0)
            return 0;
        let overlap = 0;
        for (const token of left) {
            if (right.has(token))
                overlap += 1;
        }
        return overlap / Math.min(left.size, right.size);
    }
    inferActions(node) {
        const actions = new Set();
        const role = node.role || "";
        if (role === "button" ||
            role === "link" ||
            node.tagName === "button" ||
            node.tagName === "a" ||
            node.tagName === "summary") {
            actions.add("click");
        }
        if (role === "textbox" ||
            role === "searchbox" ||
            role === "spinbutton" ||
            node.tagName === "input" ||
            node.tagName === "textarea") {
            actions.add("type");
            actions.add("fill");
        }
        if (role === "checkbox" || role === "switch" || role === "radio") {
            actions.add("click");
            actions.add("toggle");
        }
        if (role === "combobox" || node.tagName === "select") {
            actions.add("select");
            actions.add("click");
        }
        if (role === "grid" || role === "list" || role === "table") {
            actions.add("inspect");
        }
        return Array.from(actions);
    }
    buildRegionsFromNodes(context, nodes) {
        const regions = [];
        const pushRegion = (priority, kind, summary, bounds, regionNodes, reasons) => {
            if (regionNodes.length === 0)
                return;
            regions.push({
                id: `region_${String(regions.length + 1).padStart(3, "0")}`,
                priority,
                kind,
                summary,
                score: 0,
                bounds,
                reasons,
                nodeIds: regionNodes.slice(0, 60).map((node) => node.sceneId),
                candidateRefs: regionNodes
                    .filter((node) => node.mcpRef || node.actions.length > 0)
                    .slice(0, 20)
                    .map((node) => ({
                    sceneId: node.sceneId,
                    mcpRef: node.mcpRef,
                    runtimeSelector: node.mcpRef ? undefined : node.selector,
                    label: node.label || node.ariaLabel || node.text || node.placeholder,
                    role: node.role,
                    actions: node.actions,
                })),
            });
        };
        const activeSurfaceNodes = nodes.filter((node) => node.bounds
            ? [...context.dialogs, ...context.overlays, ...context.menusAndPopups].some((surface) => surface.bounds && this.isInside(node.bounds, surface.bounds))
            : false);
        const activeSurfaceBounds = context.dialogs[0]?.bounds || context.overlays[0]?.bounds || context.menusAndPopups[0]?.bounds;
        pushRegion("active-surface", "top-layer", "Currently active overlay/dialog/menu surface.", activeSurfaceBounds, activeSurfaceNodes, ["visible top-layer surface should usually be handled before background UI"]);
        const mainBounds = {
            x: Math.round(context.viewport.width * 0.2),
            y: 0,
            width: Math.round(context.viewport.width * 0.8),
            height: context.viewport.height,
        };
        pushRegion("main-work-area", "main", context.title || context.url, mainBounds, nodes.filter((node) => node.bounds && this.isInside(node.bounds, mainBounds)), ["right/central visible work area"]);
        const leftBounds = {
            x: 0,
            y: 0,
            width: Math.round(context.viewport.width * 0.35),
            height: context.viewport.height,
        };
        pushRegion("navigation-or-left-rail", "left-region", "Left side interactive region.", leftBounds, nodes.filter((node) => node.bounds && this.isInside(node.bounds, leftBounds)), ["left-side dense interactive area"]);
        const topBounds = {
            x: 0,
            y: 0,
            width: context.viewport.width,
            height: Math.round(context.viewport.height * 0.18),
        };
        pushRegion("toolbar-or-header", "top-region", "Top toolbar/header controls.", topBounds, nodes.filter((node) => node.bounds && this.isInside(node.bounds, topBounds)), ["top horizontal controls"]);
        const formNodes = nodes.filter((node) => ["field", "action"].includes(this.regionKind(node)) || node.actions.some((action) => ["type", "fill"].includes(action)));
        pushRegion("form-cluster", "field-action-cluster", "Visible editable fields and nearby actions.", this.unionBounds(formNodes), formNodes, ["cluster of editable fields/actions"]);
        const denseNodes = nodes.filter((node) => (node.componentHints || []).some((hint) => /grid|table|list|data|calendar|picker/.test(hint)) || ["grid", "table", "list"].includes(node.role || ""));
        pushRegion("dense-data-region", "grid-list-or-repeated-content", "Dense data/list/grid-like region.", this.unionBounds(denseNodes), denseNodes, ["dense repeated structure"]);
        return regions.slice(0, 12);
    }
    unionBounds(nodes) {
        const bounds = nodes.map((node) => node.bounds).filter((item) => Boolean(item));
        if (bounds.length === 0)
            return undefined;
        const left = Math.min(...bounds.map((item) => item.x));
        const top = Math.min(...bounds.map((item) => item.y));
        const right = Math.max(...bounds.map((item) => item.x + item.width));
        const bottom = Math.max(...bounds.map((item) => item.y + item.height));
        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }
    rankRegions(regions, nodes, context, perceptionQuestion) {
        const query = (perceptionQuestion || "").toLowerCase();
        return regions
            .map((region) => {
            let score = 0;
            const reasons = [...region.reasons];
            if (region.priority === "active-surface") {
                score += 100;
                reasons.push("active top-layer surface");
            }
            if (region.priority === "main-work-area")
                score += 40;
            if (region.priority === "form-cluster" && /field|form|input|type|fill|date|color|create|save/.test(query)) {
                score += 60;
                reasons.push("query likely concerns a form or action cluster");
            }
            if (region.priority === "dense-data-region" && /grid|table|row|event|calendar|list|card|visible/.test(query)) {
                score += 60;
                reasons.push("query likely concerns dense/repeated content");
            }
            if (context.errorsAndAlerts.length > 0 && region.nodeIds.some((id) => nodes.find((node) => node.sceneId === id && this.regionKind(node) === "alert-live-region"))) {
                score += 50;
                reasons.push("contains visible error/alert");
            }
            const regionText = region.candidateRefs
                .map((candidate) => `${candidate.label || ""} ${candidate.role || ""}`)
                .join(" ")
                .toLowerCase();
            const overlap = query ? this.tokenOverlap(query, regionText) : 0;
            if (overlap > 0) {
                score += Math.round(overlap * 80);
                reasons.push("text overlaps current perception question");
            }
            return {
                ...region,
                score,
                reasons,
            };
        })
            .sort((a, b) => b.score - a.score);
    }
    buildSemanticSearch(nodes, perceptionQuestion) {
        const query = perceptionQuestion?.trim() || "";
        if (!query) {
            return [
                {
                    query: "primary actionable elements",
                    status: "answered",
                    candidates: nodes
                        .filter((node) => node.actions.length > 0)
                        .slice(0, 8)
                        .map((node) => this.toCandidate(node, 10, "actionable visible element")),
                },
            ];
        }
        const candidates = nodes
            .map((node) => {
            let score = Math.round(this.tokenOverlap(query.toLowerCase(), node.rankText) * 100);
            if (node.mcpRef)
                score += 15;
            if (node.actions.length > 0)
                score += 10;
            if (/click|button|create|save|submit|select/.test(query.toLowerCase()) && node.actions.includes("click")) {
                score += 20;
            }
            if (/type|fill|enter|write/.test(query.toLowerCase()) && node.actions.some((action) => action === "type" || action === "fill")) {
                score += 20;
            }
            return { node, score };
        })
            .filter((item) => item.score >= 20)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        const status = candidates.length === 0 ? "not_found" : candidates.length === 1 || candidates[0].score - candidates[1].score > 20 ? "answered" : "ambiguous";
        return [
            {
                query,
                status,
                candidates: candidates.map((item) => this.toCandidate(item.node, item.score, "matched perception question")),
                recommendedNextObservation: candidates.length === 0
                    ? "Use focused screenshot vision or inspect a different ranked region."
                    : status === "ambiguous"
                        ? "Inspect the top candidate region or ask a more specific query."
                        : undefined,
            },
        ];
    }
    toCandidate(node, score, reason) {
        return {
            sceneId: node.sceneId,
            mcpRef: node.mcpRef,
            runtimeSelector: node.mcpRef ? undefined : node.selector,
            label: node.label || node.ariaLabel || node.text || node.placeholder,
            role: node.role,
            value: node.value,
            actions: node.actions,
            bounds: node.bounds,
            score,
            reason,
        };
    }
    buildObservationContract(perceptionQuestion, semanticSearch, rankedRegions, context) {
        const search = semanticSearch[0];
        const hasActiveSurface = context.dialogs.length + context.overlays.length + context.menusAndPopups.length > 0;
        const blockers = [
            ...context.accessibilityWarnings,
            ...context.errorsAndAlerts.map((item) => item.text || item.label || item.ariaLabel || "visible alert"),
        ].filter(Boolean).slice(0, 8);
        if (!perceptionQuestion) {
            return {
                question: "What is the current UI state and most relevant region?",
                requiredOutput: "Ranked generic regions, actionable candidates, visible errors, active surface.",
                status: rankedRegions.length > 0 ? "answered" : "not_found",
                answerSummary: rankedRegions[0]
                    ? `Focused region: ${rankedRegions[0].kind} (${rankedRegions[0].priority}).`
                    : "No meaningful region found.",
                recommendedNextObservation: rankedRegions[0]
                    ? undefined
                    : "Use screenshot vision for full-page visual understanding.",
                blockers,
            };
        }
        if (!search || search.status === "not_found") {
            return {
                question: perceptionQuestion,
                requiredOutput: "Concrete relevant region and 1-5 actionable candidates with MCP refs when possible.",
                status: hasActiveSurface ? "needs_visual" : "not_found",
                answerSummary: "No strong semantic candidate found in the current scene graph.",
                recommendedNextObservation: hasActiveSurface
                    ? "Ask cropped screenshot vision for the active surface or inspect another ranked region."
                    : "Ask screenshot vision or navigate/scroll to reveal the target region.",
                blockers,
            };
        }
        return {
            question: perceptionQuestion,
            requiredOutput: "Concrete relevant region and 1-5 actionable candidates with MCP refs when possible.",
            status: search.status,
            answerSummary: `${search.candidates.length} candidate(s) found for the perception question.`,
            recommendedNextObservation: search.recommendedNextObservation,
            blockers,
        };
    }
    buildGenericRegions(context) {
        const regions = [];
        for (const item of [...context.dialogs, ...context.overlays, ...context.menusAndPopups].slice(0, 8)) {
            regions.push({
                id: `region_${regions.length + 1}`,
                priority: "active-surface",
                kind: this.regionKind(item),
                summary: this.elementSummaryText(item),
                bounds: item.bounds,
                position: item.position,
                hints: item.componentHints,
                relevantChildren: this.childrenInside(context, item).slice(0, 18),
            });
        }
        regions.push({
            id: `region_${regions.length + 1}`,
            priority: "main-work-area",
            kind: "main-visible-content",
            summary: context.title || context.url,
            bounds: {
                x: Math.round(context.viewport.width * 0.2),
                y: 0,
                width: Math.round(context.viewport.width * 0.8),
                height: context.viewport.height,
            },
            relevantChildren: [
                ...context.fields.slice(0, 14),
                ...context.interactiveElements.slice(0, 18),
                ...context.tablesAndLists.slice(0, 8),
            ].map((item) => this.compactElement(item)),
        });
        const leftControls = context.interactiveElements.filter((item) => item.bounds && item.bounds.x < context.viewport.width * 0.35);
        if (leftControls.length >= 5) {
            regions.push({
                id: `region_${regions.length + 1}`,
                priority: "navigation-or-left-rail",
                kind: "left-interactive-region",
                summary: "Dense left-side interactive region, likely navigation or controls.",
                bounds: {
                    x: 0,
                    y: 0,
                    width: Math.round(context.viewport.width * 0.35),
                    height: context.viewport.height,
                },
                relevantChildren: leftControls.slice(0, 20).map((item) => this.compactElement(item)),
            });
        }
        return regions.slice(0, 8);
    }
    childrenInside(context, container) {
        if (!container.bounds) {
            return [];
        }
        const all = [
            ...context.fields,
            ...context.interactiveElements,
            ...context.errorsAndAlerts,
            ...context.tablesAndLists,
        ];
        return all
            .filter((item) => item.bounds && this.isInside(item.bounds, container.bounds))
            .slice(0, 30)
            .map((item) => this.compactElement(item));
    }
    isInside(child, parent) {
        const childCenterX = child.x + child.width / 2;
        const childCenterY = child.y + child.height / 2;
        return (childCenterX >= parent.x &&
            childCenterX <= parent.x + parent.width &&
            childCenterY >= parent.y &&
            childCenterY <= parent.y + parent.height);
    }
    compactElement(item) {
        return {
            kind: this.regionKind(item),
            role: item.role,
            tagName: item.tagName,
            label: item.label || item.ariaLabel || item.text || item.placeholder,
            value: item.value,
            disabled: item.disabled,
            selected: item.selected,
            checked: item.checked,
            expanded: item.expanded,
            position: item.position,
            bounds: item.bounds,
            hints: item.componentHints,
        };
    }
    regionKind(item) {
        const hints = item.componentHints ?? [];
        if (hints.includes("dialog") || item.role === "dialog")
            return "dialog-or-modal";
        if (hints.includes("select-popup") || item.role === "listbox")
            return "menu-or-popup";
        if (hints.includes("table-or-grid") || item.role === "grid")
            return "grid-or-list";
        if (item.role === "textbox" || item.tagName === "input" || item.tagName === "textarea")
            return "field";
        if (item.role === "button" || item.tagName === "button")
            return "action";
        return item.role || item.tagName;
    }
    looksLikePrimaryAction(item) {
        const text = `${item.label || ""} ${item.ariaLabel || ""} ${item.text || ""}`.toLowerCase();
        return (item.role === "button" ||
            item.tagName === "button" ||
            /\b(add|create|save|submit|next|continue|confirm|apply|delete|edit|search)\b/.test(text));
    }
    elementSummaryText(item) {
        return [
            this.regionKind(item),
            item.label || item.ariaLabel || item.text || item.placeholder,
            item.value ? `value=${item.value}` : "",
        ]
            .filter(Boolean)
            .join(": ")
            .slice(0, 300);
    }
    getExtractionCode() {
        return `async (page) => {
  return await page.evaluate(() => {
    const MAX_TEXT = 5000;
    let sceneCounter = 0;

    function clean(value) {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\\s+/g, " ").trim();
    }

    function attr(el, name) {
      return clean(el.getAttribute(name));
    }

    function ensureSceneId(el) {
      const existing = attr(el, "data-ai-scene-id");
      if (existing) return existing;
      sceneCounter += 1;
      const id = "scene_" + String(sceneCounter).padStart(4, "0");
      el.setAttribute("data-ai-scene-id", id);
      return id;
    }

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function bounds(el) {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    function positionFromBounds(rect) {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const horizontal =
        centerX < window.innerWidth * 0.33
          ? "left"
          : centerX > window.innerWidth * 0.66
          ? "right"
          : "center";
      const vertical =
        centerY < window.innerHeight * 0.33
          ? "top"
          : centerY > window.innerHeight * 0.66
          ? "bottom"
          : "middle";
      return vertical === "middle" && horizontal === "center"
        ? "center"
        : vertical + " " + horizontal;
    }

    function labelFor(el) {
      const aria = attr(el, "aria-label");
      if (aria) return aria;

      const labelledBy = attr(el, "aria-labelledby");
      if (labelledBy) {
        const text = labelledBy
          .split(/\\s+/)
          .map((id) => clean(document.getElementById(id)?.textContent))
          .filter(Boolean)
          .join(" ");
        if (text) return text;
      }

      if (el.id) {
        const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        const text = clean(label?.textContent);
        if (text) return text;
      }

      const parentLabel = clean(el.closest("label")?.textContent);
      if (parentLabel) return parentLabel;

      const formControl = el.closest(".MuiFormControl-root,.MuiTextField-root,.mat-form-field,.ant-form-item");
      const visibleLabel = clean(formControl?.querySelector("label,.MuiFormLabel-root,.MuiInputLabel-root,.ant-form-item-label")?.textContent);
      if (visibleLabel) return visibleLabel;

      return "";
    }

    function componentHints(el) {
      const hints = new Set();
      let current = el;
      let depth = 0;

      while (current && depth < 5) {
        const cls = typeof current.className === "string" ? current.className : "";
        const role = attr(current, "role");
        const tag = current.tagName.toLowerCase();

        if (role) hints.add("role:" + role);
        if (tag === "dialog" || role === "dialog" || attr(current, "aria-modal") === "true") hints.add("dialog");
        if (role === "alert" || attr(current, "aria-live")) hints.add("alert-live-region");
        if (role === "menu" || role === "menubar") hints.add("menu");
        if (role === "listbox" || role === "option") hints.add("select-popup");
        if (role === "grid" || role === "table" || tag === "table") hints.add("table-or-grid");
        if (role === "tablist" || role === "tab") hints.add("tabs");
        if (cls.includes("Mui")) hints.add("mui");
        if (cls.includes("MuiDialog")) hints.add("mui-dialog");
        if (cls.includes("MuiPopover") || cls.includes("MuiPopper")) hints.add("mui-popover");
        if (cls.includes("MuiPickers") || cls.includes("MuiDate") || cls.includes("datepicker") || cls.includes("date-picker")) hints.add("date-picker");
        if (cls.includes("timepicker") || cls.includes("time-picker")) hints.add("time-picker");
        if (cls.includes("MuiAutocomplete") || cls.includes("react-select") || cls.includes("select")) hints.add("custom-select");
        if (cls.includes("modal") || cls.includes("dialog") || cls.includes("overlay") || cls.includes("backdrop")) hints.add("overlay-or-modal");
        if (cls.includes("toast") || cls.includes("snackbar") || cls.includes("alert") || cls.includes("error")) hints.add("message-or-error");
        if (current.hasAttribute("contenteditable")) hints.add("rich-text-editor");

        current = current.parentElement;
        depth += 1;
      }

      return Array.from(hints).slice(0, 8);
    }

    function summary(el) {
      const html = el;
      const input = el;
      const rect = bounds(el);
      const style = window.getComputedStyle(el);
      const tagName = el.tagName.toLowerCase();
      const role = attr(el, "role") || undefined;
      const text = clean(html.innerText || el.textContent).slice(0, 500) || undefined;
      const value = "value" in input ? clean(input.value).slice(0, 200) : undefined;
      const sceneId = ensureSceneId(el);

      return {
        sceneId,
        selector: '[data-ai-scene-id="' + sceneId + '"]',
        tagName,
        role,
        type: tagName === "input" ? clean(input.type || "text") : undefined,
        text,
        label: labelFor(el) || undefined,
        placeholder: attr(el, "placeholder") || undefined,
        value,
        ariaLabel: attr(el, "aria-label") || undefined,
        ariaModal: attr(el, "aria-modal") || undefined,
        ariaHidden: attr(el, "aria-hidden") || undefined,
        inert: el.hasAttribute("inert"),
        disabled: Boolean(input.disabled) || attr(el, "aria-disabled") === "true",
        required: Boolean(input.required) || attr(el, "aria-required") === "true",
        checked: "checked" in input ? Boolean(input.checked) : undefined,
        expanded: attr(el, "aria-expanded") || undefined,
        selected: attr(el, "aria-selected") === "true" || undefined,
        componentHints: componentHints(el),
        position: positionFromBounds(rect),
        bounds: rect,
        visible: isVisible(el),
        zIndex: style.zIndex && style.zIndex !== "auto" ? style.zIndex : undefined,
      };
    }

    function visibleList(selector, limit) {
      return Array.from(document.querySelectorAll(selector))
        .filter((el) => isVisible(el))
        .slice(0, limit)
        .map(summary);
    }

    function looksOverlay(el) {
      if (!isVisible(el)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
      const id = (el.id || "").toLowerCase();
      const role = attr(el, "role");
      const fixedOrAbsolute = style.position === "fixed" || style.position === "absolute" || style.position === "sticky";
      const largeLayer = rect.width >= window.innerWidth * 0.35 && rect.height >= window.innerHeight * 0.2;
      const modalName = /modal|dialog|overlay|backdrop|drawer|popover|popper|portal/.test(cls + " " + id);
      return fixedOrAbsolute && (largeLayer || modalName || role === "dialog" || attr(el, "aria-modal") === "true");
    }

    function accessibilityWarnings() {
      const warnings = [];
      const visibleDialogLike = Array.from(document.querySelectorAll("dialog,[role='dialog'],[aria-modal='true'],[class*='Dialog'],[class*='dialog'],[class*='modal'],[class*='Modal']"))
        .filter((el) => isVisible(el));

      for (const el of visibleDialogLike.slice(0, 6)) {
        if (!attr(el, "role") && el.tagName.toLowerCase() !== "dialog") {
          warnings.push("Visible dialog-like component has no role=dialog.");
        }
        if (attr(el, "aria-modal") !== "true" && el.tagName.toLowerCase() !== "dialog") {
          warnings.push("Visible dialog-like component has no aria-modal=true.");
        }
      }

      const active = document.activeElement;
      if (active && active !== document.body && active.closest("[aria-hidden='true'],[inert]")) {
        warnings.push("Focused element is inside aria-hidden or inert subtree.");
      }

      return Array.from(new Set(warnings)).slice(0, 10);
    }

    const fieldSelector = "input:not([type='hidden']),textarea,select,[contenteditable='true'],[contenteditable=''],[role='textbox'],[role='combobox'],[role='searchbox'],[role='spinbutton']";
    const interactiveSelector = "button,a[href],input:not([type='hidden']),textarea,select,[role='button'],[role='link'],[role='checkbox'],[role='radio'],[role='tab'],[role='menuitem'],[role='option'],[role='switch'],[tabindex]:not([tabindex='-1']),summary";
    const errorSelector = "[role='alert'],[aria-live],.error,.Error,.invalid,.Invalid,.alert,.Alert,.toast,.Toast,.snackbar,.Snackbar,[class*='error'],[class*='Error'],[class*='invalid'],[class*='Invalid']";
    const menuSelector = "[role='menu'],[role='menubar'],[role='listbox'],[role='tree'],[role='tooltip'],[class*='Menu'],[class*='menu'],[class*='Popover'],[class*='popover'],[class*='Popper'],[class*='popper']";
    const tableSelector = "table,[role='table'],[role='grid'],[role='list'],[class*='DataGrid'],[class*='Table'],[class*='table']";

    const overlays = Array.from(document.querySelectorAll("body *"))
      .filter(looksOverlay)
      .sort((a, b) => {
        const az = Number.parseInt(window.getComputedStyle(a).zIndex || "0", 10) || 0;
        const bz = Number.parseInt(window.getComputedStyle(b).zIndex || "0", 10) || 0;
        return bz - az;
      })
      .slice(0, 10)
      .map(summary);

    const allHints = new Set();
    [
      ...visibleList("[role='dialog'],dialog,[aria-modal='true']", 10),
      ...overlays,
      ...visibleList(fieldSelector, 30),
      ...visibleList(interactiveSelector, 40),
      ...visibleList(menuSelector, 15),
      ...visibleList(tableSelector, 10),
    ].forEach((item) => (item.componentHints || []).forEach((hint) => allHints.add(hint)));

    const active = document.activeElement && document.activeElement !== document.body
      ? summary(document.activeElement)
      : undefined;

    const context = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
      },
      activeElement: active,
      visibleText: clean(document.body.innerText).slice(0, MAX_TEXT),
      dialogs: visibleList("[role='dialog'],dialog,[aria-modal='true']", 10),
      overlays,
      forms: visibleList("form,[role='form'],fieldset", 12),
      fields: visibleList(fieldSelector, 35),
      interactiveElements: visibleList(interactiveSelector, 50),
      errorsAndAlerts: visibleList(errorSelector, 20),
      menusAndPopups: visibleList(menuSelector, 20),
      tablesAndLists: visibleList(tableSelector, 12),
      componentHints: Array.from(allHints).slice(0, 30),
      accessibilityWarnings: accessibilityWarnings(),
    };

    return JSON.stringify(context);
  });
}`;
    }
}
exports.EnhancedMcpSnapshotTool = EnhancedMcpSnapshotTool;
