export {}

declare global {
  interface Window {
    storage?: {
      get?: (key: string) => Promise<any> | any,
      set?: (key: string, value: any) => Promise<void> | void
    }
  }
}
