# React + Vite
This is clone of a project Maverick-Assessment added docker-compose file,so you can run the app in docker too.

```yaml                            
services:
    maverik:
        image: maverick
        container_name: maverick
        restart: always
        ports:
          - "5173:5173"
        environment:
          - VITE_BACKEND_URL=http://enter_ur_local_ip:5000
    
    backend:
        image: backend
        container_name: backend
        restart: always
        ports:
          - "5000:5000"
```

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
# Maverick-Assessment

