// Removed reference to vite/client to fix missing type definition error
// Declaring process.env for API_KEY access as per guidelines

declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  }
};

interface ImportMetaEnv {
  readonly VITE_API_KEY: string;
  readonly API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
