"use client";
import * as React from "react";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (<textarea ref={ref} className={`border rounded-md w-full p-2 ${className||''}`} {...props} />)
);
Textarea.displayName = "Textarea";


