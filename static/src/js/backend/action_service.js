/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";

patch(registry.category("services").get("action"), {
  start(env) {
    const base = super.start(env);
    const doActionButtonDef = base.doActionButton;

    async function doActionButton(params) {
      const uuid_client = localStorage.getItem("uuid_client")
     
      params.context = { ...params.context, uuid_client: uuid_client }

      // For all other actions, use the original implementation
      const result = await doActionButtonDef(params);
    }

    // Replace the original function with our enhanced version
    base.doActionButton = doActionButton;
    return base;
  },
});