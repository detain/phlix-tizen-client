var e=new Map;function r(t){return e.get(t)}function i(t,n=Date.now()){return t!==void 0&&n-t.ts<6e4}function u(t,n,o=Date.now()){e.set(t,{item:n,ts:o})}export{i as n,u as r,r as t};
