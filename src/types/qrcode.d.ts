declare module 'qrcode' {
  const qrcode: any;
  export default qrcode;
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: any, text: string, options?: any): Promise<void>;
}
