## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## UI changes (Soft Pop)

Before changing any UI, read the memory notes `soft-pop-source-of-truth` and `render-canvas-boards-locally`, then compare against the real components in `packages/mobile/components/ui/*` (Button, FilterControls, tab-bar, RowCard, list-kit), not `theme.ts` tokens alone. Mockups use those components' real radii, fonts and elevations. Check a mockup against the app before showing it. The Soft Pop spec is in the artboard project via DesignSync, not the design-system project (that one is Pixel).

Before reporting mobile work done, run the whole `npx jest` for `packages/mobile`, not a subset. A shortcut href change once broke a guard test that a subset run skipped.

@~/.claude/pstack-models.md
