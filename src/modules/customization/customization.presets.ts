import { METAL_SWATCH_COLORS } from "@/lib/customization-swatches";

export type CustomizationPresetKey = "rings" | "necklaces" | "earrings" | "bracelets";

export interface CustomizationValidationRules {
  requiresStone?: boolean;
  categoryKeywords?: string[];
  dependsOn?: {
    groupCode: string;
    valuesIn?: string[];
    valuesNotIn?: string[];
  };
}

export interface PresetOptionValueDraft {
  value: string;
  label: string;
  swatchHex?: string | null;
  swatchImageUrl?: string | null;
  priceAdjustmentType: "NONE" | "FIXED" | "PERCENT";
  priceAdjustmentValue: string;
  isAvailable: boolean;
  sortOrder: number;
}

export interface PresetOptionGroupDraft {
  code: string;
  label: string;
  type:
    "SELECT" | "MULTI_SELECT" | "SWATCH" | "NUMBER_RANGE" | "TEXT" | "TEXTAREA" | "IMAGE_UPLOAD";
  helperText?: string | null;
  placeholder?: string | null;
  required: boolean;
  minValue?: string | null;
  maxValue?: string | null;
  stepValue?: string | null;
  defaultValue?: string | null;
  maxLength?: number | null;
  maxFiles?: number | null;
  unit?: string | null;
  validationRules?: CustomizationValidationRules | null;
  isActive: boolean;
  sortOrder: number;
  values: PresetOptionValueDraft[];
}

const SHARED_METALS: PresetOptionValueDraft[] = [
  {
    value: "platinum_950",
    label: "Platinum 950",
    swatchHex: METAL_SWATCH_COLORS.platinum950,
    priceAdjustmentType: "FIXED",
    priceAdjustmentValue: "250.00",
    isAvailable: true,
    sortOrder: 0,
  },
  {
    value: "gold_18k_yellow",
    label: "18K Yellow Gold",
    swatchHex: METAL_SWATCH_COLORS.gold18kYellow,
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 1,
  },
  {
    value: "gold_18k_white",
    label: "18K White Gold",
    swatchHex: METAL_SWATCH_COLORS.gold18kWhite,
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 2,
  },
  {
    value: "gold_18k_rose",
    label: "18K Rose Gold",
    swatchHex: METAL_SWATCH_COLORS.gold18kRose,
    priceAdjustmentType: "FIXED",
    priceAdjustmentValue: "50.00",
    isAvailable: true,
    sortOrder: 3,
  },
];

const SHARED_STONE_SHAPES: PresetOptionValueDraft[] = [
  {
    value: "round",
    label: "Round Brilliant",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 0,
  },
  {
    value: "oval",
    label: "Oval Brilliant",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "4",
    isAvailable: true,
    sortOrder: 1,
  },
  {
    value: "emerald",
    label: "Emerald Step-Cut",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "6",
    isAvailable: true,
    sortOrder: 2,
  },
  {
    value: "cushion",
    label: "Cushion Modified",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "5",
    isAvailable: true,
    sortOrder: 3,
  },
  {
    value: "pear",
    label: "Pear Teardrop",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "6",
    isAvailable: true,
    sortOrder: 4,
  },
  {
    value: "no_stone",
    label: "Metal Only (No Center Stone)",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 5,
  },
];

const DIAMOND_COLOR_GRADES: PresetOptionValueDraft[] = [
  {
    value: "D",
    label: "D — Exceptionally Colourless",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "14",
    isAvailable: true,
    sortOrder: 0,
  },
  {
    value: "E",
    label: "E — Colourless",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "9",
    isAvailable: true,
    sortOrder: 1,
  },
  {
    value: "F",
    label: "F — Colourless",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "5",
    isAvailable: true,
    sortOrder: 2,
  },
  {
    value: "G",
    label: "G — Near Colourless (Maison Standard)",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 3,
  },
  {
    value: "H",
    label: "H — Near Colourless",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 4,
  },
];

const DIAMOND_CLARITY_GRADES: PresetOptionValueDraft[] = [
  {
    value: "FL_IF",
    label: "FL / IF — Flawless",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "18",
    isAvailable: true,
    sortOrder: 0,
  },
  {
    value: "VVS1",
    label: "VVS1 — Very Very Slightly Included",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "10",
    isAvailable: true,
    sortOrder: 1,
  },
  {
    value: "VVS2",
    label: "VVS2 — Very Very Slightly Included",
    priceAdjustmentType: "PERCENT",
    priceAdjustmentValue: "5",
    isAvailable: true,
    sortOrder: 2,
  },
  {
    value: "VS1",
    label: "VS1 — Eye-Clean (Maison Standard)",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 3,
  },
  {
    value: "VS2",
    label: "VS2 — Very Slightly Included",
    priceAdjustmentType: "NONE",
    priceAdjustmentValue: "0",
    isAvailable: true,
    sortOrder: 4,
  },
];

function buildReferenceImagesGroup(sortOrder: number): PresetOptionGroupDraft {
  return {
    code: "reference_images",
    label: "Inspiration & Reference Images",
    type: "IMAGE_UPLOAD",
    helperText:
      "Upload sketches, inspiration pieces, or setting references (JPG, PNG, WebP · max 5 files, 5 MB each).",
    required: false,
    maxFiles: 5,
    isActive: true,
    sortOrder,
    values: [],
  };
}

export const CUSTOMIZATION_CATEGORY_PRESETS: Record<
  CustomizationPresetKey,
  PresetOptionGroupDraft[]
> = {
  rings: [
    {
      code: "metal",
      label: "Precious Metal",
      type: "SWATCH",
      helperText: "All metals are recycled and hallmarked to atelier standard.",
      required: true,
      isActive: true,
      sortOrder: 0,
      values: SHARED_METALS,
    },
    {
      code: "stone_shape",
      label: "Center Stone Cut",
      type: "SELECT",
      helperText: "Select diamond or gemstone cut proportions.",
      required: true,
      isActive: true,
      sortOrder: 1,
      values: SHARED_STONE_SHAPES,
    },
    {
      code: "diamond_color",
      label: "Diamond Colour Grade",
      type: "SELECT",
      helperText: "Applied when your configuration includes a center diamond.",
      required: true,
      validationRules: {
        requiresStone: true,
        dependsOn: { groupCode: "stone_shape", valuesNotIn: ["no_stone"] },
      },
      isActive: true,
      sortOrder: 2,
      values: DIAMOND_COLOR_GRADES,
    },
    {
      code: "clarity",
      label: "Diamond Clarity",
      type: "SELECT",
      helperText: "Graded under 10x magnification by GIA / IGI.",
      required: true,
      validationRules: {
        requiresStone: true,
        dependsOn: { groupCode: "stone_shape", valuesNotIn: ["no_stone"] },
      },
      isActive: true,
      sortOrder: 3,
      values: DIAMOND_CLARITY_GRADES,
    },
    {
      code: "carat_weight",
      label: "Preferred Carat Weight",
      type: "NUMBER_RANGE",
      helperText: "Master gemologists source ethically verified stones to your exact carat goal.",
      required: false,
      minValue: "0.50",
      maxValue: "5.00",
      stepValue: "0.10",
      defaultValue: "1.50",
      unit: "ct",
      validationRules: {
        requiresStone: true,
        dependsOn: { groupCode: "stone_shape", valuesNotIn: ["no_stone"] },
      },
      isActive: true,
      sortOrder: 4,
      values: [],
    },
    {
      code: "ring_size",
      label: "Ring Size (US / UK / EU)",
      type: "SELECT",
      helperText: "Complimentary first resize included within 30 days.",
      required: true,
      validationRules: { categoryKeywords: ["ring", "band", "bridal", "solitaire"] },
      isActive: true,
      sortOrder: 5,
      values: [
        {
          value: "US_4.5",
          label: "US 4.5 · UK I · EU 48",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "US_5",
          label: "US 5 · UK J 1/2 · EU 49",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "US_6",
          label: "US 6 · UK L 1/2 · EU 52",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 2,
        },
        {
          value: "US_7",
          label: "US 7 · UK N 1/2 · EU 54",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 3,
        },
        {
          value: "US_8",
          label: "US 8 · UK P 1/2 · EU 57",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 4,
        },
        {
          value: "US_9",
          label: "US 9 · UK R 1/2 · EU 59",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 5,
        },
      ],
    },
    {
      code: "band_width",
      label: "Band Width",
      type: "SELECT",
      helperText: "Shank profile thickness.",
      required: false,
      isActive: true,
      sortOrder: 6,
      values: [
        {
          value: "1.6mm",
          label: "1.6 mm — Delicate Knife-Edge",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "2.0mm",
          label: "2.0 mm — Classic Comfort Fit",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "2.5mm",
          label: "2.5 mm — Substantial Court",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "140.00",
          isAvailable: true,
          sortOrder: 2,
        },
        {
          value: "3.5mm",
          label: "3.5 mm — Architectural Ribbon",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "280.00",
          isAvailable: true,
          sortOrder: 3,
        },
      ],
    },
    {
      code: "engraving",
      label: "Inner Band Engraving",
      type: "TEXT",
      helperText: "Complimentary hand or laser engraving up to 32 characters.",
      placeholder: "e.g. E & L · 14.06.26",
      required: false,
      maxLength: 32,
      isActive: true,
      sortOrder: 7,
      values: [],
    },
    buildReferenceImagesGroup(8),
  ],
  necklaces: [
    {
      code: "metal",
      label: "Precious Metal",
      type: "SWATCH",
      required: true,
      isActive: true,
      sortOrder: 0,
      values: SHARED_METALS,
    },
    {
      code: "stone_shape",
      label: "Pendant Stone Cut",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 1,
      values: SHARED_STONE_SHAPES,
    },
    {
      code: "carat_weight",
      label: "Stone Carat Weight",
      type: "NUMBER_RANGE",
      minValue: "0.25",
      maxValue: "4.00",
      stepValue: "0.05",
      defaultValue: "1.00",
      unit: "ct",
      required: false,
      validationRules: {
        requiresStone: true,
        dependsOn: { groupCode: "stone_shape", valuesNotIn: ["no_stone"] },
      },
      isActive: true,
      sortOrder: 2,
      values: [],
    },
    {
      code: "chain_length",
      label: "Chain Length",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 3,
      values: [
        {
          value: "16in",
          label: "16 in (40 cm — Collar)",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "18in",
          label: "18 in (45 cm — Princess)",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "20in",
          label: "20 in (50 cm — Matinee)",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "110.00",
          isAvailable: true,
          sortOrder: 2,
        },
        {
          value: "22in",
          label: "22 in (55 cm — Long)",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "180.00",
          isAvailable: true,
          sortOrder: 3,
        },
      ],
    },
    {
      code: "chain_type",
      label: "Chain Link Style",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 4,
      values: [
        {
          value: "cable",
          label: "Fine Trace Cable",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "box",
          label: "Venetian Box",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "75.00",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "wheat",
          label: "Spiga Wheat",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "120.00",
          isAvailable: true,
          sortOrder: 2,
        },
      ],
    },
    {
      code: "engraving",
      label: "Pendant Tag Engraving",
      type: "TEXT",
      maxLength: 24,
      placeholder: "Optional initials or date",
      required: false,
      isActive: true,
      sortOrder: 5,
      values: [],
    },
    buildReferenceImagesGroup(6),
  ],
  earrings: [
    {
      code: "metal",
      label: "Precious Metal",
      type: "SWATCH",
      required: true,
      isActive: true,
      sortOrder: 0,
      values: SHARED_METALS,
    },
    {
      code: "stone_shape",
      label: "Matched Pair Cut",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 1,
      values: SHARED_STONE_SHAPES.filter((v) => v.value !== "no_stone"),
    },
    {
      code: "carat_per_stone",
      label: "Carat Per Ear",
      type: "NUMBER_RANGE",
      minValue: "0.25",
      maxValue: "2.50",
      stepValue: "0.05",
      defaultValue: "0.75",
      unit: "ct / ear",
      required: false,
      isActive: true,
      sortOrder: 2,
      values: [],
    },
    {
      code: "backing_type",
      label: "Earring Backing & Lock",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 3,
      values: [
        {
          value: "screw_back",
          label: "Threaded Screw Back",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "la_poussette",
          label: "La Poussette Double-Release Lock",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "160.00",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "friction_post",
          label: "Butterfly Friction Post",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 2,
        },
      ],
    },
    buildReferenceImagesGroup(4),
  ],
  bracelets: [
    {
      code: "metal",
      label: "Precious Metal",
      type: "SWATCH",
      required: true,
      isActive: true,
      sortOrder: 0,
      values: SHARED_METALS,
    },
    {
      code: "wrist_size",
      label: "Wrist Length",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 1,
      values: [
        {
          value: "15.5cm",
          label: "15.5 cm (6.1 in — Petite)",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "16.5cm",
          label: "16.5 cm (6.5 in — Standard S)",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "17.5cm",
          label: "17.5 cm (6.9 in — Classic M)",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 2,
        },
        {
          value: "18.5cm",
          label: "18.5 cm (7.3 in — Comfort L)",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "180.00",
          isAvailable: true,
          sortOrder: 3,
        },
      ],
    },
    {
      code: "carat_total",
      label: "Total Carat Weight",
      type: "NUMBER_RANGE",
      minValue: "1.00",
      maxValue: "12.00",
      stepValue: "0.50",
      defaultValue: "3.00",
      unit: "ctw",
      required: false,
      isActive: true,
      sortOrder: 2,
      values: [],
    },
    {
      code: "clasp_type",
      label: "Clasp Mechanism",
      type: "SELECT",
      required: true,
      isActive: true,
      sortOrder: 3,
      values: [
        {
          value: "box_safety",
          label: "Hidden Box Clasp + Twin Safety Latches",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 0,
        },
        {
          value: "lobster",
          label: "Swivel Lobster Clasp",
          priceAdjustmentType: "NONE",
          priceAdjustmentValue: "0",
          isAvailable: true,
          sortOrder: 1,
        },
        {
          value: "toggle",
          label: "T-Bar Architectural Toggle",
          priceAdjustmentType: "FIXED",
          priceAdjustmentValue: "90.00",
          isAvailable: true,
          sortOrder: 2,
        },
      ],
    },
    buildReferenceImagesGroup(4),
  ],
};

export function detectCategoryPresetKey(slugOrName: string): CustomizationPresetKey {
  const s = slugOrName.toLowerCase();
  if (s.includes("neck") || s.includes("pendant") || s.includes("chain")) return "necklaces";
  if (s.includes("ear") || s.includes("stud") || s.includes("hoop")) return "earrings";
  if (s.includes("brace") || s.includes("bangle") || s.includes("cuff") || s.includes("tennis")) {
    return "bracelets";
  }
  return "rings";
}
