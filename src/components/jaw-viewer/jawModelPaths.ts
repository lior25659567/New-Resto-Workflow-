// New Blender-exported models with embedded RGBA vertex colors — no separate texture file needed.
import newLowerJaw   from '@/assets/3d-models/new 3d models /Lower.ply?url';
import newUpperJaw   from '@/assets/3d-models/new 3d models /Upper.ply?url';
import newBothArches from '@/assets/3d-models/new 3d models /Both Arches.ply?url';
import bite          from '@/assets/3d-models/Bite.ply?url';

export const jawModels = {
  upper_pretreatment: newUpperJaw,
  upper_treatment:    newUpperJaw,
  lower_pretreatment: newLowerJaw,
  lower_treatment:    newLowerJaw,
  bite,
  both_arches:        newBothArches,
};

// Empty strings: new models have vertex colors baked in, no texture atlas required.
// Legacy iTero models would use their _texture.jpg paths here.
export const jawTextures = {
  upper_pretreatment: '',
  upper_treatment:    '',
  lower_pretreatment: '',
  lower_treatment:    '',
  bite:               '',
  both_arches:        '',
};
