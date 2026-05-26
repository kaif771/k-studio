declare module 'react-simple-code-editor' {
    import * as React from 'react';
    export interface EditorProps {
        value: string;
        onValueChange: (value: string) => void;
        highlight: (value: string) => React.ReactNode;
        padding?: number | string;
        style?: React.CSSProperties;
        className?: string;
        textareaId?: string;
        textareaClassName?: string;
        preClassName?: string;
        placeholder?: string;
        disabled?: boolean;
        onKeyDown?: any;
        onScroll?: any;
    }
    class Editor extends React.Component<EditorProps> {}
    export default Editor;
}

declare module 'prismjs' {
    const Prism: any;
    export default Prism;
}
