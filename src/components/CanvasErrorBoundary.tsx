import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackKey?: string | number; // When this changes (like mural index or mode), we auto-reset the errorstate
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class CanvasErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CanvasErrorBoundary caught a rendering error:", error, errorInfo);
  }

  public componentDidUpdate(prevProps: Props) {
    // If the mural, view, or key changes, proactively reset the error state to allow a fresh rendering attempt!
    if (prevProps.fallbackKey !== this.props.fallbackKey) {
      if (this.state.hasError) {
        this.resetError();
      }
    }
  }

  private resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[460px] bg-[#14120f] border border-red-900/30 rounded-xs flex flex-col items-center justify-center p-8 text-center select-none relative overflow-hidden">
          {/* Subtle glowing decorative background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-red-900/5 rounded-full filter blur-3xl pointer-events-none"></div>
          
          <div className="relative z-10 max-w-md mx-auto flex flex-col items-center">
            {/* Elegant stylized danger/warning icon */}
            <div className="w-14 h-14 rounded-full bg-red-950/20 border border-red-800/30 flex items-center justify-center mb-5">
              <AlertCircle className="w-7 h-7 text-[#e15b53]" />
            </div>

            <span className="text-[10px] tracking-[0.3em] uppercase text-[#e15b53]/80 font-serif block mb-1.5">
              CANVAS RENDERING CONTEXT SUSPENDED
            </span>
            <h3 className="text-xl font-serif text-[#f5f2ed] tracking-wider mb-3">
              画卷数字化重光遇到阻碍
            </h3>
            <p className="text-xs text-[#8b7e6a] leading-relaxed mb-6 font-serif">
              由于浏览器 WebGL/Canvas 2D 绘图线程或临时缓存发生异常，导致敦煌重彩数字图层未能成功复原。请尝点击下方按钮重置画卷，或重新挑选朝代卷轴。
            </p>

            <button
              onClick={this.resetError}
              className="px-5 py-2.5 bg-[#b3322a]/15 hover:bg-[#b3322a]/25 border border-[#b3322a]/40 hover:border-[#b3322a]/60 text-xs text-[#e15b53] rounded-xs flex items-center gap-2 transition-all cursor-pointer font-serif tracking-wider"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重新挂载并复原画卷</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
