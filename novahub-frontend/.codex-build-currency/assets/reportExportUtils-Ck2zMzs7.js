async function C(l){try{const i=await(await fetch(l)).blob();return await new Promise((b,p)=>{const r=new FileReader;r.onloadend=()=>b(r.result),r.onerror=p,r.readAsDataURL(i)})}catch{return null}}function s(l){return l?/oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(l):!1}function L(l,u,i){const b=u.createElement("style");b.innerHTML=`
      :root, *, *::before, *::after {
        --background: #ffffff !important;
        --foreground: #333333 !important;
        --card: #ffffff !important;
        --card-foreground: #333333 !important;
        --popover: #ffffff !important;
        --popover-foreground: #333333 !important;
        --primary: ${i} !important;
        --primary-foreground: #ffffff !important;
        --secondary: #f3f4f6 !important;
        --secondary-foreground: #333333 !important;
        --muted: #f3f4f6 !important;
        --muted-foreground: #6b7280 !important;
        --accent: #f3f4f6 !important;
        --accent-foreground: #333333 !important;
        --destructive: #ef4444 !important;
        --destructive-foreground: #ffffff !important;
        --border: #e5e7eb !important;
        --input: #e5e7eb !important;
        --ring: ${i} !important;
        --chart-1: #10b981 !important;
        --chart-2: #ef4444 !important;
        --chart-3: #6366f1 !important;
        --chart-4: #f59e0b !important;
        --chart-5: #ec4899 !important;
        --sidebar-background: #ffffff !important;
        --sidebar-foreground: #333333 !important;
        --sidebar-primary: ${i} !important;
        --sidebar-primary-foreground: #ffffff !important;
        --sidebar-accent: #f3f4f6 !important;
        --sidebar-accent-foreground: #333333 !important;
        --sidebar-border: #e5e7eb !important;
        --sidebar-ring: ${i} !important;
      }
    `,u.head.appendChild(b);const p=(r,f)=>{var d,h,k,P,v;if(!r||!f)return;const g=[r,...Array.from(r.querySelectorAll("*"))],c=[f,...Array.from(f.querySelectorAll("*"))];for(let w=0;w<Math.min(g.length,c.length);w++){const x=g[w],e=c[w];if(!(!x||!e))try{const m=window.getComputedStyle(x);let a="#333333";const t=((h=(d=x.className)==null?void 0:d.toString)==null?void 0:h.call(d))||"";if(t.includes("text-primary")?a=i:t.includes("text-emerald")?a="#10b981":t.includes("text-rose")?a="#f43f5e":t.includes("text-purple")?a="#a855f7":t.includes("text-green")?a="#22c55e":t.includes("text-red")?a="#ef4444":t.includes("text-blue")?a="#3b82f6":(t.includes("text-amber")||t.includes("text-orange"))&&(a="#f59e0b"),s(m.color)&&e.style.setProperty("color",a,"important"),s(m.backgroundColor)){let n="transparent";t.includes("bg-primary")?n=i:t.includes("bg-emerald")?n="#10b981":t.includes("bg-rose")?n="#f43f5e":t.includes("bg-muted")?n="#f3f4f6":t.includes("bg-card")||t.includes("bg-background")?n="#ffffff":(t.includes("bg-secondary")||t.includes("bg-accent"))&&(n="#f3f4f6"),e.style.setProperty("background-color",n,"important")}s(m.borderColor)&&e.style.setProperty("border-color","#e5e7eb","important"),s(m.outlineColor)&&e.style.setProperty("outline-color","#e5e7eb","important"),s(m.backgroundImage)&&e.style.setProperty("background-image","none","important"),s(m.boxShadow)&&e.style.setProperty("box-shadow","none","important"),s(m.textDecorationColor)&&e.style.setProperty("text-decoration-color",a,"important");const A=((P=(k=e.tagName)==null?void 0:k.toLowerCase)==null?void 0:P.call(k))||"";if(A==="svg"||(v=e.closest)!=null&&v.call(e,"svg")||["path","rect","circle","line","polygon","polyline","g","text","tspan"].includes(A)){const n=e.getAttribute("fill"),o=e.getAttribute("stroke"),y=e.getAttribute("stop-color");n&&(s(n)||n.includes("var("))&&(t.includes("recharts-bar-rectangle")||t.includes("recharts-pie-sector")||e.setAttribute("fill","#9ca3af")),o&&(s(o)||o.includes("var("))&&e.setAttribute("stroke","#e5e7eb"),y&&(s(y)||y.includes("var("))&&e.setAttribute("stop-color",i)}if(e.style)for(let n=0;n<e.style.length;n++){const o=e.style[n],y=e.style.getPropertyValue(o);s(y)&&(o.includes("color")||o==="fill"||o==="stroke"?e.style.setProperty(o,a,"important"):o.includes("background")?e.style.setProperty(o,"#ffffff","important"):o.includes("border")||o.includes("outline")?e.style.setProperty(o,"#e5e7eb","important"):o.includes("shadow")&&e.style.setProperty(o,"none","important"))}}catch{}}};l.forEach(r=>{p(document.getElementById(r),u.getElementById(r))});try{const r=u.styleSheets;for(let f=0;f<r.length;f++)try{const g=r[f].cssRules;for(let c=0;c<g.length;c++){const d=g[c];if(d.cssText&&s(d.cssText)){const h=d.cssText.replace(/oklch\([^)]*\)/gi,"#9ca3af").replace(/oklab\([^)]*\)/gi,"#9ca3af");try{r[f].deleteRule(c),r[f].insertRule(h,c)}catch{}}}}catch{}}catch{}}async function E(l,u){const i=await l.xlsx.writeBuffer(),b=new Blob([i],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),p=document.createElement("a");p.href=URL.createObjectURL(b),p.download=u,p.click()}export{E as d,C as g,L as s};
//# sourceMappingURL=reportExportUtils-Ck2zMzs7.js.map
