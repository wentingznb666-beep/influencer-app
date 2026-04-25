import "element-plus/dist/index.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";

import App from "./App.vue";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ElementPlus);

useAuthStore(pinia).initFromStorage();

app.mount("#app");

