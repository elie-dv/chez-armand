import { createApp } from 'vue';
import 'leaflet/dist/leaflet.css';
import AdminApp from './AdminApp.vue';
import '../../admin.css';

createApp(AdminApp).mount('#admin-root');
