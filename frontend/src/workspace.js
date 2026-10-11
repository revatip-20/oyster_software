export const sections = {
  supervisors: {
    label: "Supervisors",
    singular: "Supervisor",
    description: "Manage supervisor access to the workspace.",
    columns: [
      ["first_name", "First name"],
      ["last_name", "Last name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["role", "Role"],
    ],
    fields: [
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      {
        name: "password",
        label: "Password",
        type: "password",
        required: true,
        minLength: 8,
      },
    ],
    updateFields: [
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      {
        name: "password",
        label: "New password (leave blank to keep current)",
        type: "password",
        minLength: 8,
      },
    ],
  },
  employees: {
    label: "Employees",
    singular: "Employee",
    description: "View and manage employee records.",
    columns: [
      ["code", "Code"],
      ["first_name", "First name"],
      ["last_name", "Last name"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["joining_date", "Joining date"],
      ["role", "Role"],
    ],
    fields: [
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "joining_date", label: "Joining date", type: "date", required: true },
    ],
    updateFields: [
      { name: "first_name", label: "First name", required: true },
      { name: "last_name", label: "Last name", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "joining_date", label: "Joining date", type: "date" },
    ],
  },
  rawMaterials: {
    label: "Raw materials",
    singular: "Raw material",
    description: "Manage raw material names and units.",
    columns: [
      ["id", "ID"],
      ["code", "Code"],
      ["material_name", "Name"],
      ["unit", "Unit"],
    ],
    fields: [
      { name: "material_name", label: "Material name", required: true },
      { name: "unit", label: "Unit", required: true },
    ],
    updateFields: [
      { name: "material_name", label: "Material name", required: true },
      { name: "unit", label: "Unit", required: true },
    ],
  },
  elements: {
    label: "Elements",
    singular: "Element",
    description: "View and manage elements and their related records.",
    columns: [
      ["id", "ID"],
      ["code", "Code"],
      ["element_name", "Name"],
      ["unit", "Unit"],
    ],
    fields: [
      { name: "element_name", label: "Element name", required: true },
      { name: "unit", label: "Unit" },
    ],
    updateFields: [
      { name: "element_name", label: "Element name", required: true },
      { name: "unit", label: "Unit" },
    ],
  },
  suppliers: {
    label: "Suppliers",
    singular: "Supplier",
    description: "Manage supplier contacts and business details.",
    columns: [
      ["code", "Code"],
      ["company_name", "Company"],
      ["contact_person", "Contact person"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["city", "City"],
      ["state", "State"],
      ["gst_number", "GST number"],
    ],
    fields: [
      { name: "company_name", label: "Company name", required: true },
      { name: "contact_person", label: "Contact person", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "address", label: "Address", wide: true, required: true },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State", required: true },
      { name: "gst_number", label: "GST number", required: true },
    ],
    updateFields: [
      { name: "company_name", label: "Company name", required: true },
      { name: "contact_person", label: "Contact person", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "address", label: "Address", wide: true, required: true },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State", required: true },
      { name: "gst_number", label: "GST number", required: true },
    ],
  },
  customers: {
    label: "Customers",
    singular: "Customer",
    description: "Manage customer contacts and business details.",
    columns: [
      ["code", "Code"],
      ["company_name", "Company"],
      ["contact_person", "Contact person"],
      ["email", "Email"],
      ["phone", "Phone"],
      ["city", "City"],
      ["state", "State"],
    ],
    fields: [
      { name: "company_name", label: "Company name", required: true },
      { name: "contact_person", label: "Contact person", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "address", label: "Address", wide: true, required: true },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State", required: true },
    ],
    updateFields: [
      { name: "company_name", label: "Company name", required: true },
      { name: "contact_person", label: "Contact person", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "phone", label: "Phone", required: true },
      { name: "address", label: "Address", wide: true, required: true },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State", required: true },
    ],
  },
  
dailyInputs: {
  label: "Daily Inputs",
  singular: "Daily Input",
  description: "Record incoming element and raw material quantities.",

  columns: [
    ["id", "ID"],
    ["DC_no", "DC No."],
    ["DC_date", "DC Date"],
    ["bill_no", "Bill No."],
    ["bill_date", "Bill Date"],
    ["quantity", "Quantity"],
    ["type", "Type"],
    ["raw_material_id", "Raw material"],
    ["element_id", "Element"],
    ["supplier_id", "Supplier"],
    ["customer_id", "Customer"],
  ],

  fields: [
    // Document fields: first row
    { name: "DC_no", label: "DC No.", required: true, row: 1 },
    { name: "DC_date", label: "DC Date", type: "date", required: true, row: 1 },
    { name: "bill_no", label: "Bill No.", required: true, row: 1 },
    { name: "bill_date", label: "Bill Date", type: "date", required: true, row: 1 },

    { name: "quantity", label: "Quantity", type: "number", min: "1", step: "1", required: true },

    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "raw_material", label: "Raw material" },
        { value: "element", label: "Element" },
      ],
      defaultValue: "raw_material",
    },

    {
      name: "raw_material_id",
      label: "Raw material",
      type: "rawMaterial",
      dependsOnType: "raw_material",
      required: true,
    },

    {
      name: "element_id",
      label: "Element",
      type: "element",
      dependsOnType: "element",
      required: true,
    },

    {
      name: "unit",
      label: "Unit",
      required: false,
      readOnly: true,
      restricted: true
    },

    {
      name: "supplier_id",
      label: "Supplier",
      type: "supplier",
      dependsOnType: ["raw_material", "element"],
      required: (type) => type === "raw_material",
    },

    {
      name: "customer_id",
      label: "Customer",
      type: "customer",
      dependsOnType: "element",
      required: false,
    },
  ],

  updateFields: [
    // Document fields: first row
    { name: "DC_no", label: "DC No.", required: true, row: 1 },
    { name: "DC_date", label: "DC Date", type: "date", required: true, row: 1 },
    { name: "bill_no", label: "Bill No.", required: true, row: 1 },
    { name: "bill_date", label: "Bill Date", type: "date", required: true, row: 1 },

    { name: "quantity", label: "Quantity", type: "number", min: "1", step: "1", required: true },

    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "raw_material", label: "Raw material" },
        { value: "element", label: "Element" },
      ],
    },

    {
      name: "raw_material_id",
      label: "Raw material",
      type: "rawMaterial",
      dependsOnType: "raw_material",
      required: true,
    },

    {
      name: "element_id",
      label: "Element",
      type: "element",
      dependsOnType: "element",
      required: true,
    },

    {
      name: "unit",
      label: "Unit",
      required: false,
      readOnly: true,
      restricted: true
    },

    {
      name: "supplier_id",
      label: "Supplier",
      type: "supplier",
      dependsOnType: ["raw_material", "element"],
      required: (type) => type === "raw_material",
    },

    {
      name: "customer_id",
      label: "Customer",
      type: "customer",
      dependsOnType: "element",
      required: false,
    },
  ],
},

};

export const navigation = [
  { id: "dashboard", label: "Dashboard", marker: "D" },
  { id: "supervisors", label: "Supervisors", marker: "S", adminOnly: true },
  { id: "employees", label: "Employees", marker: "E" },
  { id: "rawMaterials", label: "Raw materials", marker: "R" },
  { id: "elements", label: "Elements", marker: "L" },
  { id: "suppliers", label: "Suppliers", marker: "S" },
  { id: "customers", label: "Customers", marker: "C" },
  { id: "dailyInputs", label: "Daily Inputs", marker: "I", roles: ["admin", "supervisor"] },
];
