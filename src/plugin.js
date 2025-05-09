// Import Spectrum components
import '@swc-uxp-wrappers/utils';
import '@spectrum-web-components/theme/src/themes.js';
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons-ui/icons/sp-icon-arrow500.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-add.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-wrench.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-delete.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-link.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-unlink.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-layers.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-maximize.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-rotate-c-w.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-magic-wand.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-edit.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-application-delivery.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-duplicate.js';
import '@spectrum-web-components/icons-workflow/icons/sp-icon-education.js';
import '@spectrum-web-components/icons-ui/src/index.js';

import '@swc-uxp-wrappers/button/sp-button.js';
import '@swc-uxp-wrappers/button-group/sp-button-group.js';
import '@swc-uxp-wrappers/checkbox/sp-checkbox.js';
import '@swc-uxp-wrappers/action-bar/sp-action-bar.js';
import '@swc-uxp-wrappers/action-button/sp-action-button.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-heading.js';
import '@swc-uxp-wrappers/sidenav/sp-sidenav-item.js';
import '@swc-uxp-wrappers/switch/sp-switch.js';
import '@swc-uxp-wrappers/field-group/sp-field-group.js';
import '@swc-uxp-wrappers/field-label/sp-field-label.js';
import '@swc-uxp-wrappers/textfield/sp-textfield.js';
import '@swc-uxp-wrappers/dialog/sp-dialog.js';
import '@swc-uxp-wrappers/divider/sp-divider.js';

import Editor from './editor.js';
import Builder from './builder.js';

// Configurations and Constants
import { creativeConfigs } from "./js/constants/creativeConfigs.js";
import { getPSTheme } from "./js/helpers/themeSetter.js";
import { getEl } from "./js/helpers/utils.js";


const { core, constants } = require("photoshop");
const { LayerKind } = constants;

const Plugin = (() => {
    // UXP modules
    console.log('loading plugin');
    const mode = 'velocity';
    const creativeState = {
        ...creativeConfigs.find(config => config.name === mode)
    };

    const plugin = {
        currentMode: 'build',
        sections: {
            nav: {
                element: getEl('sp-sidenav'),
                activeAttribute: 'data-active-menu',
                targetElement: getEl('.plugin-content')
            },
            production: {
            }
        }
    }

    const {nav} = plugin.sections; 

    function setActiveMenu(event) {
        plugin.currentMode = event.target.value;
        nav.targetElement.setAttribute(nav.activeAttribute, plugin.currentMode);
    }
    
    async function applyTheme() {
        const themeValue = await getPSTheme();
        document.getElementById('theme').setAttribute("color", themeValue);
    }

    // --- Initialization ---
    const initializePanel = () => {
        Editor.initializeSection();
        Builder.initializeSection();
        //Assign Event Listeners
        nav.element.addEventListener('change', setActiveMenu);
        applyTheme();
    }

    return { initializePanel }
})();

export default Plugin;