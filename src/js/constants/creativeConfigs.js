const creativeConfigs = [
  {
    type: 'creative',
    name: 'velocity',
    devices: {
      desktop:{
        device: 'desktop',
        abbreviation: 'dt',
        dimensions: {
          height: 450,
          width: 1920
        },
        tile: {},    
        sequences: {          
          intro: {
            device: 'desktop',
            name: 'intro',
            abbreviation: 'dt',
            artboards: [],   ///artboard schema: {step: int, board: Layer, id: board.id int}
            maxSteps: 2,
            artboardNamePattern: 'intro-${step}-panel:dt',
          },
          expanded: { 
            device: 'desktop',
            name: 'expanded',
            abbreviation: 'dt',
            artboards: [],
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-expanded-panel:dt',
          },
          collapsed: {
            device: 'desktop',
            name: 'collapsed',
            abbreviation: 'dt',
            artboards: [],
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-collapsed-panel:dt',
          }
        }
      },
      mobile:{
        device: 'mobile',
        abbreviation: 'mb',
        dimensions: {
          height: 450,
          width: 860
        },
        sequences: {
          intro: {
            device: 'mobile',
            name: 'intro',
            abbreviation: 'mb',
            artboards: [],
            maxSteps: 100,
            artboardNamePattern: 'intro-${step}-panel:mb',
          },
          expanded: {
            device: 'mobile',
            name: 'expanded',
            abbreviation: 'mb',
            artboards: [],
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-expanded-panel:mb',
          },
          collapsed: {
            device: 'mobile',
            name: 'collapsed',
            abbreviation: 'mb',
            artboards: [],
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-collapsed-panel:mb',
          },
        }
      }
    },
  },
  {
    name: 'hangtime',
    devices: {
      mobile: {
        device: 'mobile',
        abbreviation: '',
        sequenceTypes: {
          main: {
            device: 'mobile',
            name: 'main',
            abbreviation: 'md',
            artboards: [],
            maxSteps: 100,
            artboardNamePattern: '${*}-${step}',
          }
        }
      }
    }
  }
];

export { creativeConfigs };
