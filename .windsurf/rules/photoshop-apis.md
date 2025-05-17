---
trigger: always_on
---

1. All Photoshop interactions must utilize the modern UXP/Photoshop APIs and not the legacy CEP APIs. 
2. Prefer built-in Photoshop APIs when available and utilize batchAction commands when they are not.
3. UI components should leverage the subset of Adobe's Spectrum Web Component that are wrapped by swc-uxp-wrappers as the first option and fall back to standard html/css components when its not. 

