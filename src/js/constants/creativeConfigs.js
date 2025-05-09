const creativeConfigs = [
  {
    name: 'velocity',
    devices: [{
      device: 'desktop',
      abbreviation: 'dt',
      dimensions: {
        height: 450,
        width: 1920
      },
      tile: {},
      sequences: [],
      sequenceTypes: {
        intro: {
          maxSteps: 2,
          artboardNamePattern: 'intro-${step}-panel:dt',
        },
        expanded: {
          maxSteps: 3,
          artboardNamePattern: 'morph-${step}-expanded-panel:dt',
        },
        collapsed: {
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-collapsed-panel:dt',
        }
      }
    },
    {
      device: 'mobile',
      abbreviation: 'dt',
      dimensions: {
        height: 450,
        width: 860
      },
      sequenceTypes: {
        intro: {
          maxSteps: 2,
          artboardNamePattern: 'intro-${step}-panel:dt',
        },
        expanded: {
          maxSteps: 3,
          artboardNamePattern: 'morph-${step}-expanded-panel:dt',
        },
        collapsed: {
            maxSteps: 3,
            artboardNamePattern: 'morph-${step}-collapsed-panel:dt',
        },
      },
      sequences: []
    }]
  },
  {
    name: 'hangtime',
    devices: [{
      device: 'mobile',
      abbreviation: '',
      sequenceTypes: {
        main: {
          maxSteps: 100,
          artboardNamePattern: '${*}-${step}',
        }
      },
      sequences: []
    }]
  }
];

export { creativeConfigs };