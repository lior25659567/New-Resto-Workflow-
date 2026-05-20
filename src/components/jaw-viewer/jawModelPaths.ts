import upperJawPretreatment from '@/assets/3d-models/iTero_upper_pretreatment.ply?url';
import upperJawTreatment from '@/assets/3d-models/iTero_upper_treatment.ply?url';
import lowerJawPretreatment from '@/assets/3d-models/iTero_lower_pretreatment.ply?url';
import lowerJawTreatment from '@/assets/3d-models/iTero_lower_treatment.ply?url';
import bite from '@/assets/3d-models/Bite.ply?url';

import upperTexture from '@/assets/3d-models/iTero_upper_treatment_texture.jpg?url';
import lowerTreatmentTexture from '@/assets/3d-models/iTero_lower_treatment_texture.jpg?url';
import lowerPretreatmentTexture from '@/assets/3d-models/iTero_lower_pretreatment_texture.jpg?url';

export const jawModels = {
  upper_pretreatment: upperJawPretreatment,
  upper_treatment: upperJawTreatment,
  lower_pretreatment: lowerJawPretreatment,
  lower_treatment: lowerJawTreatment,
  bite,
};

// Each model's companion texture for vertex-color baking
export const jawTextures = {
  upper_pretreatment: upperTexture,           // same source file as treatment
  upper_treatment: upperTexture,
  lower_pretreatment: lowerPretreatmentTexture,
  lower_treatment: lowerTreatmentTexture,
};
