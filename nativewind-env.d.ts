/// <reference types="nativewind/types" />

// Side-effect import of the Tailwind entry file (App.tsx) -- Metro/NativeWind
// handle it at build time, TS just needs to know the specifier is valid.
declare module '*.css';
