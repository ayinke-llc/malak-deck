import * as ReactDOM from 'react-dom';

// Polyfill for unmountComponentAtNode
if (typeof (ReactDOM as any).unmountComponentAtNode !== 'function') {
  (ReactDOM as any).unmountComponentAtNode = (container: Element | DocumentFragment) => {
    const root = (ReactDOM as any).createRoot(container);
    root.unmount();
    return true;
  };
} 