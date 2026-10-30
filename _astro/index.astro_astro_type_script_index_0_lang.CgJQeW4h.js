var e={presence:{energy:.23,flow:.72,expansion:0,hue:.15,focus:0,routing:0},listening:{energy:.43,flow:.85,expansion:0,hue:.55,focus:.12,routing:0},considering:{energy:.96,flow:1.45,expansion:0,hue:.72,focus:1,routing:.48},consulting:{energy:1.1,flow:2.3,expansion:0,hue:1.08,focus:.7,routing:1.6}},t=`
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`,n=`
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uEnergy;
uniform float uExpansion;
uniform float uHue;
uniform float uVariant;
uniform float uFocus;
uniform float uRouting;

const float TAU = 6.28318530718;

float gauss(float distance, float width) {
  float d = distance / width;
  return exp(-d * d);
}

float wave(float a, float t, float offset) {
  return sin(a * 3.0 + t * 0.115 + offset) * 0.018
       + sin(a * 7.0 - t * 0.15 + offset * 1.6) * 0.009
       + sin(a * 11.0 + t * 0.072 + offset * 0.63) * 0.004;
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uResolution / min(uResolution.x, uResolution.y);

  // A gentle elliptical perspective. The silhouette stays recognisable.
  float turn = -0.11;
  p = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * p;
  p.y /= 0.93;
  p.x += p.y * 0.035;

  float r = length(p);
  float a = atan(p.y, p.x);
  float t = uTime;
  float pixel = 2.0 / min(uResolution.x, uResolution.y);
  float radius = 0.685 + uExpansion;
  float shape = wave(a, t, 0.0);
  float d = r - radius - shape;
  float breath = 0.5 + 0.5 * sin(t * 0.22);
  float energy = 0.82 + uEnergy * 0.48;
  float front = 0.62 + 0.38 * (0.5 - 0.5 * sin(a - 0.5));

  vec3 violet = vec3(0.22, 0.16, 0.76);
  vec3 azure = vec3(0.11, 0.42, 0.94);
  vec3 cyan = vec3(0.21, 0.83, 1.0);
  vec3 ice = vec3(0.57, 0.94, 1.0);
  vec3 color = vec3(0.0);

  // Broad translucent toroidal fabric, with an intentionally dark centre.
  float envelope = gauss(d, 0.076 + 0.008 * breath);
  float tube = d / 0.09;
  float weaveA = abs(sin(tube * 43.0 + sin(a * 6.0 - t * 0.1) * 2.1
                          + sin(a * 13.0 + t * 0.06) * 0.7));
  float weaveB = abs(sin(a * 124.0 + tube * 6.8 + sin(a * 9.0) * 0.7));
  float threadA = smoothstep(0.89, 1.0, weaveA);
  float threadB = smoothstep(0.96, 1.0, weaveB);
  float weave = threadA * 0.093 + threadA * threadB * 0.17;
  float angularShade = 0.55 + 0.45 * pow(0.5 + 0.5 * sin(a * 2.0 - t * 0.07), 2.0);
  color += mix(violet, azure, 0.24 + uHue * 0.16)
         * envelope * (0.033 + weave) * angularShade * front;

  // Outer field lines are much quieter than the principal form.
  float outer = r - radius - 0.078 - wave(a, t, 1.8) * 0.55;
  float field = gauss(outer, 0.06);
  float fieldLines = pow(0.5 + 0.5 * cos(outer * 395.0
                  + sin(a * 4.0 + t * 0.08) * 2.4), 12.0);
  float fieldCells = 0.35 + 0.65 * pow(0.5 + 0.5 * cos(a * 146.0
                  + outer * 41.0), 7.0);
  color += violet * field * fieldLines * fieldCells * 0.1 * front;

  // Filaments travel through the form rather than rotating a flat image.
  for (int i = 0; i < 9; i++) {
    float f = float(i) / 8.0;
    float offset = (f - 0.5) * 0.058;
    float ribbon = radius + offset + wave(a, t, f * 2.4)
                 + sin(a * 5.0 - t * 0.12 + f * 5.0) * (0.009 + f * 0.012);
    float rd = r - ribbon;
    float traveling = 0.5 + 0.5 * sin(a * 3.0 - t * 0.19 + f * 4.0);
    float light = pow(traveling, 8.0);
    float strand = gauss(rd, max(pixel * 0.75, 0.00105 + f * 0.00038));
    float halo = gauss(rd, 0.008 + light * 0.008);
    float spread = gauss(rd, 0.026);
    vec3 threadColor = mix(azure, cyan, light * 0.75 + uHue * 0.15);
    color += threadColor * (strand * (0.1 + light * (0.31 + 0.35 * uFocus))
            + halo * (0.018 + light * (0.067 + 0.04 * uFocus)) + spread * light * 0.014)
            * front * energy;
  }

  // Sparse pools of light give direction without a constellation of UI dots.
  float crest = radius - 0.015 + wave(a, t, 0.6);
  float arcLight = pow(0.5 + 0.5 * cos(a * 3.0 - t * 0.16 + 0.8), 28.0);
  float fineLight = pow(0.5 + 0.5 * cos(a * 7.0 + t * 0.11), 40.0) * 0.22;
  float knot = (arcLight + fineLight) * gauss(r - crest, 0.023);
  color += cyan * knot * (0.37 + 0.54 * uFocus) * energy;
  color += ice * (arcLight + fineLight) * gauss(r - crest, 0.0025) * (0.45 + 0.62 * uFocus);

  // Three distinct travelling light lanes indicate CONSULTING in the local
  // scripted study. They're bounded to the same physical Ring radius, not
  // independent model/progress dots. Only the encounter Ring receives uRouting.
  float routingLight = 0.0;
  for (int j = 0; j < 3; j++) {
    float lane = float(j);
    float laneRadius = radius + (lane - 1.0) * 0.023;
    float laneDistance = r - laneRadius - wave(a, t, lane * 0.7) * 0.20;
    float frequency = 3.0 + lane * 2.0; // integer angular periodicity
    float phase = a * frequency - t * (0.39 + lane * 0.17) * (1.0 + 0.55 * uRouting) + lane * 2.1;
    float lead = pow(0.5 + 0.5 * cos(phase), 22.0);
    float tail = pow(0.5 + 0.5 * cos(phase + 0.48), 10.0);
    float laneTrace = gauss(laneDistance, max(pixel * 0.88, 0.0023));
    routingLight += laneTrace * (0.12 + 1.35 * lead + 0.38 * tail);
  }
  // A conspicuous change in hue, motion and luminous circulation when
  // the illustrative route opens. No change to Ring geometry or hero variant.
  vec3 routeTint = mix(vec3(0.55, 0.30, 1.0), cyan, 0.50 + 0.23 * sin(t * 0.36));
  color += routeTint * routingLight * uRouting * 1.05;
  float routeHalo = gauss(d, 0.037) * (0.5 + 0.5 * sin(a * 3.0 - t * 0.50));
  color += mix(azure, ice, 0.55) * routeHalo * max(0.0, uRouting - 0.70) * 0.11;

  // Soft atmospheric light occupies the immediate edge, never the whole page.
  color += azure * gauss(d, 0.092) * 0.028 * energy;
  color += violet * gauss(r - radius - 0.04, 0.145) * 0.017;
  color *= smoothstep(0.36, 0.52, r);
  color *= 1.0 - smoothstep(0.92, 1.04, r);
  color *= mix(1.24, 1.12, uVariant);

  // Transparent premultiplied output allows the Ring to inhabit the page.
  color = 1.0 - exp(-color * 1.45);
  float alpha = clamp(max(color.r, max(color.g, color.b)) * 1.16, 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`;function r(e,r){let i=e.createShader(e.VERTEX_SHADER),a=e.createShader(e.FRAGMENT_SHADER),o=e.createProgram(),s=e.createBuffer(),c=()=>{i&&e.deleteShader(i),a&&e.deleteShader(a),o&&e.deleteProgram(o),s&&e.deleteBuffer(s)};if(!i||!a||!o||!s)return r(`resource-allocation-failed`),c(),null;let l=e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT),u=l&&l.precision>0?n:n.replace(`precision highp float;`,`precision mediump float;`);e.shaderSource(i,t),e.shaderSource(a,u),e.compileShader(i),e.compileShader(a);let d=e.getShaderParameter(i,e.COMPILE_STATUS),f=e.getShaderParameter(a,e.COMPILE_STATUS);if(!d||!f)return d||r(`vertex-shader-compile-failed`,e.getShaderInfoLog(i)?.trim()),f||r(`fragment-shader-compile-failed`,e.getShaderInfoLog(a)?.trim()),c(),null;if(e.attachShader(o,i),e.attachShader(o,a),e.bindAttribLocation(o,0,`aPosition`),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS))return r(`program-link-failed`,e.getProgramInfoLog(o)?.trim()),c(),null;e.useProgram(o),e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,2,e.FLOAT,!1,0,0),e.disable(e.DEPTH_TEST),e.disable(e.CULL_FACE),e.disable(e.BLEND),e.clearColor(0,0,0,0);let p={};for(let t of[`uResolution`,`uTime`,`uEnergy`,`uExpansion`,`uHue`,`uVariant`,`uFocus`,`uRouting`])p[t]=e.getUniformLocation(o,t);return{program:o,vertex:i,fragment:a,buffer:s,uniforms:p}}function i(t,n={}){let i=(e,n)=>{t.dataset.ringFailure=e,console.warn(`[H.E.R Ring] ${e}${n?`: ${n}`:``}`)},a;try{a=t.getContext(`webgl`,{alpha:!0,antialias:!1,premultipliedAlpha:!0,depth:!1,stencil:!1,preserveDrawingBuffer:!1,powerPreference:`low-power`})}catch(e){return i(`context-exception`,String(e)),null}if(!a)return i(`context-unavailable`),null;let o=a,s;try{s=r(o,i)}catch(e){return i(`resource-exception`,String(e)),null}if(!s)return null;let c=window.matchMedia(`(prefers-reduced-motion: reduce)`),l={...e.presence},u={...e.presence},d=!1,f=!1,p=!1,m=0,h=0,g=21.4,_=0,v=0,y=t.getBoundingClientRect(),b=y.bottom>=0&&y.top<=window.innerHeight&&y.right>=0&&y.left<=window.innerWidth,x=e=>{e&&delete t.dataset.ringFailure;let n=e?`true`:`false`;t.dataset.ringReady!==n&&(t.dataset.ringReady=n,t.dispatchEvent(new CustomEvent(e?`her:ring-ready`:`her:ring-unavailable`)))},S=()=>{m&&cancelAnimationFrame(m),m=0,h=0},C=()=>!f&&!p&&b&&!document.hidden&&_>0&&v>0&&!!s,w=()=>{!m&&C()&&(m=requestAnimationFrame(T))};function T(e){if(m=0,!C()||!s)return;let t=!d&&!c.matches,r=h?Math.min((e-h)/1e3,.05):1/60;if(h=e,t){let e=1-Math.exp(-r*2.8);for(let t of[`energy`,`flow`,`expansion`,`hue`,`focus`,`routing`])l[t]+=(u[t]-l[t])*e;g+=r*l.flow}else l={...u};o.viewport(0,0,_,v),o.useProgram(s.program),o.uniform2f(s.uniforms.uResolution,_,v),o.uniform1f(s.uniforms.uTime,g),o.uniform1f(s.uniforms.uEnergy,l.energy),o.uniform1f(s.uniforms.uExpansion,l.expansion),o.uniform1f(s.uniforms.uHue,l.hue),o.uniform1f(s.uniforms.uVariant,+(n.variant===`encounter`)),o.uniform1f(s.uniforms.uFocus,n.variant===`encounter`?l.focus:0),o.uniform1f(s.uniforms.uRouting,n.variant===`encounter`?l.routing:0),o.drawArrays(o.TRIANGLES,0,3),x(!0),t?w():h=0}let E=()=>{if(f||p)return;let e=t.getBoundingClientRect();if(e.width<=0||e.height<=0){_=0,v=0,S();return}let n=Math.min(window.devicePixelRatio||1,1.6,Math.sqrt(135e4/(e.width*e.height))),r=Math.max(1,Math.round(e.width*n)),i=Math.max(1,Math.round(e.height*n));(r!==_||i!==v)&&(_=r,v=i,t.width=_,t.height=v,o.viewport(0,0,_,v)),w()},D=()=>{document.hidden?S():w()},O=()=>{S(),w()},k=e=>{e.preventDefault(),p=!0,S(),s=null,i(`context-lost`),x(!1)},A=()=>{if(!f){try{s=r(o,i)}catch(e){s=null,i(`resource-exception`,String(e))}p=!s,!p&&(_=0,v=0,E())}},j=typeof ResizeObserver<`u`?new ResizeObserver(E):null,M=typeof IntersectionObserver<`u`?new IntersectionObserver(e=>{for(let n of e)n.target===t&&(b=n.isIntersecting,b?w():S())},{threshold:0}):null;return x(!1),j?.observe(t),M?.observe(t),window.addEventListener(`resize`,E,{passive:!0}),document.addEventListener(`visibilitychange`,D),c.addEventListener(`change`,O),t.addEventListener(`webglcontextlost`,k),t.addEventListener(`webglcontextrestored`,A),E(),{setMode(t){!f&&Object.prototype.hasOwnProperty.call(e,t)&&(u={...e[t]},w())},setPaused(e){f||(d=e,S(),w())},destroy(){f||(f=!0,S(),j?.disconnect(),M?.disconnect(),window.removeEventListener(`resize`,E),document.removeEventListener(`visibilitychange`,D),c.removeEventListener(`change`,O),t.removeEventListener(`webglcontextlost`,k),t.removeEventListener(`webglcontextrestored`,A),s&&!p&&(o.deleteBuffer(s.buffer),o.deleteShader(s.vertex),o.deleteShader(s.fragment),o.deleteProgram(s.program)),s=null,x(!1))}}}var a=`/audio/her2i-starfire-m8-corrected-pause-v7.mp3`;function o(e){let t=null,n=!1,r=document.createElement(`audio`).canPlayType(`audio/mpeg`)!==``,i=!1,o=0,s=0,c=0;function l(){s&&cancelAnimationFrame(s),s=0,c=0}function u(n){s=0,!(!t||t.paused||t.ended||!r||i||document.hidden)&&((!c||n-c>=32)&&(c=n,e.onPosition(t.currentTime)),s=requestAnimationFrame(u))}function d(){s||!t||t.paused||i||!r||document.hidden||(c=0,e.onPosition(t.currentTime),s=requestAnimationFrame(u))}function f(){return t||(t=document.createElement(`audio`),t.muted=n,t.preload=`none`,t.src=a,t.addEventListener(`timeupdate`,()=>{r&&t&&e.onPosition(t.currentTime)}),t.addEventListener(`playing`,d),t.addEventListener(`pause`,l),t.addEventListener(`ended`,()=>{l(),r&&e.onEnded()}),t.addEventListener(`error`,()=>{r&&h(`The recorded sample could not be loaded. No substitute voice will play.`)})),t}function p(e){i||(n=e,t&&(t.muted=e))}function m(){if(o++,l(),t){t.pause();try{t.currentTime=0}catch{}}}function h(t){r&&!i&&(r=!1,m(),e.onError(t))}async function g(){return i||document.hidden?!1:(r=f().canPlayType(`audio/mpeg`)!==``,r)}function _(){r=!1,m()}function v(){if(!r||i||document.hidden)return;let e=f();m();let t=o;try{e.play().catch(()=>{o===t&&r&&!i&&h(`This browser could not play the recorded sample. The encounter is still available silently.`)})}catch{h(`This browser could not play the recorded sample. The encounter is still available silently.`)}}function y(){i||(_(),i=!0,t&&=(t.removeAttribute(`src`),t.load(),null))}return{enable:g,disable:_,stop:m,play:v,isEnabled:()=>r&&!i,setMuted:p,destroy:y}}var s={presence:{stage:`A quiet presence.`,prompt:`An illustrative H.E.R encounter`,answer:``},listening:{stage:`Listening — illustrative input.`,prompt:`No microphone access or recorded user speech`,answer:`An example listening interval before H.E.R considers the question.`},considering:{stage:`Considering the appropriate intelligences.`,prompt:`Scripted choice — no provider calls`,answer:`For this question, I'd bring in a specialist legal research intelligence and two independent reasoning intelligences.`},consulting:{stage:`Illustrative constellation routing.`,prompt:`Example route — no live provider execution`,answer:`Examining the authored consultation sequence…`}},c=[{at:0,text:`I'm here.`},{at:1.13,text:`Tell me what you're trying to understand.`},{at:2.75,text:`Tell me what you're trying to understand.`,stage:`Listening · illustrative`,prompt:`Simulated human question · microphone OFF`},{at:7.295,text:`For this question,`,stage:`Considering a proposed route · illustrative`,prompt:`Not an actual model selection`},{at:8.32,text:`I'd bring in a specialist legal research intelligence`},{at:11.3,text:`and two independent reasoning intelligences.`},{at:13.815,text:``,stage:`Consulting · illustrative`,prompt:`Scripted initial consultation · no provider calls`},{at:20.885,text:`Their interpretations broadly agree,`,stage:`Examining apparent agreement · illustrative`,prompt:`Hypothetical interpretations · no executed research`},{at:23.39,text:`but one assumption deserves a closer look.`},{at:26.645,text:`I've also noticed a possible ambiguity in the Georgian-to-English translation.`,stage:`Translation ambiguity · illustrative`,prompt:`Possible issue, not observed legal analysis`},{at:31.4,text:`I'd bring in a Kartuli-language specialist to examine the original wording.`,stage:`Proposing a language candidate · illustrative`,prompt:`No specialist connected or executed`},{at:35.165,text:``,stage:`Further consultation · illustrative`,prompt:`Scripted Kartuli-language consultation · no provider calls`},{at:40.56,text:`Now, something important emerges when I bring their perspectives together.`,stage:`Examining perspectives · illustrative`,prompt:`Synthesis is authored, not measured`},{at:45.695,text:`They have reached their conclusions independently,`,stage:`Shared premise · illustrative`,prompt:`Independent reasoning may share a premise`},{at:48.385,text:`but their congruence could rest on the same unverified assumption.`},{at:53.095,text:`All three interpretations rely on the phrase as translated.`},{at:57.285,text:`Yet if a word in that phrase carries a different meaning,`},{at:60.465,text:`their conclusions could materially change.`},{at:62.68,text:``,stage:`Synthesising · illustrative`,prompt:`Distinguishing agreement from a shared premise`},{at:65.045,text:`So my next synthesis will clearly separate what their findings support in common,`,stage:`Qualified synthesis · illustrative`,prompt:`Not a legal conclusion or measured protocol result`},{at:69.885,text:`from what depends on that translation—`},{at:72.18,text:`and identify what needs further verification before a tentative conclusion should be accepted.`},{at:78.72,text:`You can open the Drop to explore each intelligence's contribution,`,stage:`Explore the Drop · illustrative`,prompt:`Authored study, not model outputs`},{at:82.51,text:`where their interpretations differ,`},{at:84.52,text:`and additional insights that emerged from my synthesis.`}];function l(){let e=document.querySelector(`#hero-ring`),t=document.querySelector(`#encounter-ring`),n=document.querySelector(`#motion-toggle`),r=document.querySelector(`#sound-toggle`),a=document.querySelector(`#play-encounter`),l=document.querySelector(`#answer-drop`),u=document.querySelector(`#stage-label`),d=document.querySelector(`.sample-prompt`),f=document.querySelector(`.sample-answer`),p=document.querySelector(`#sound-feedback`),m=document.querySelector(`.encounter-window`),h=document.querySelector(`#demo-input-wave`),g=document.querySelector(`#demo-route`),_=document.querySelector(`#demo-answer-cascade`),v=document.querySelector(`#demo-extra-specialist`),y=[...document.querySelectorAll(`[data-mode]`)];if(!e||!t||!n||!a||!l||!u||!d||!f||!m||!h||!g||!_||!v)return;let b=i(e,{variant:`hero`}),x=i(t,{variant:`encounter`}),S=o({onPosition:e=>{if(!j)return;let t=e>=13.815?`consulting`:e>=7.295?`considering`:e>=2.75?`listening`:`presence`;T!==t&&Z(t),e>=9.45&&V(1),e>=11.655&&V(3),e>=13.815&&e<20.885&&H(),e>=26.645&&U(),e>=31.4&&G(),e>=35.165&&W(),e>=45.695&&K(),e>=65.045&&q();let n=e>=65.045?`considering`:e>=62.68?`consulting`:e>=40.56?`considering`:e>=35.165?`consulting`:e>=20.885?`considering`:e>=13.815?`consulting`:e>=7.295?`considering`:e>=2.75?`listening`:`presence`;E!==n&&(E=n,x?.setMode(n)),e>=62.68&&e<65.045&&(u.textContent=`Synthesising · illustrative`,d.textContent=`Tracing shared premises · not measured`),z(e)},onEnded:()=>{j&&(T!==`consulting`&&Z(`consulting`),G(),K(),q(),J(),u.textContent=`Illustrative encounter complete.`,X(!1),a.querySelector(`[data-play-label]`).textContent=`Replay H.E.R exchange`)},onError:e=>{p&&(p.textContent=e),j&&X(!1),Y()}}),C=window.matchMedia(`(prefers-reduced-motion: reduce)`),w=!1,T=`presence`,E=`presence`,D=!1,O=!1,k=!1,A=!1,j=!1,M=!1,N=!1,P=!1,F=!S.isEnabled(),I=!1,L=-1,R=[];function z(e){let t=0;for(let n=1;n<c.length&&e>=c[n].at;n++)t=n;if(t===L)return;L=t;let n=c[t];f.textContent=n.text,n.stage&&(u.textContent=n.stage),n.prompt&&(d.textContent=n.prompt)}function B(){let r=e.dataset.ringReady===`true`,i=t.dataset.ringReady===`true`,a=r||i,o=w||C.matches;b?.setPaused(o),x?.setPaused(o),n.setAttribute(`aria-pressed`,String(o)),n.disabled=C.matches||!a;let s=n.querySelector(`[data-motion-label]`);s&&(s.textContent=C.matches?`Reduced motion`:a?`${w?`Resume`:`Pause`} ${r?`motion`:`encounter motion`}`:`Static Ring`)}function V(e){e>Number(m.dataset.routeStep||`0`)&&(m.dataset.routeStep=String(e)),g.setAttribute(`aria-hidden`,`false`)}function H(){M||(M=!0,u.textContent=`Illustrative consultation · considering perspectives`,d.textContent=`Scripted, time-compressed interval · no live provider calls`,f.textContent=`Examining the proposed interpretations…`)}function U(){N||(N=!0,x?.setMode(`considering`),m.dataset.secondaryRoute=`considering`)}function W(){P||(P=!0,x?.setMode(`consulting`),m.dataset.secondaryRoute=`consulting`,u.textContent=`Further consultation · illustrative`,d.textContent=`Scripted analysis interval · no provider execution`)}function G(){k||(k=!0,m.dataset.extraSpecialist=`true`,v.setAttribute(`aria-hidden`,`false`),u.textContent=`Adding a Georgian-language candidate · illustrative`,d.textContent=`Scripted extension — no provider calls`,f.textContent=`I've also noticed a possible ambiguity in the Georgian-to-English translation. I'd bring in a Kartuli-language specialist to examine the original wording.`)}function K(){A||(A=!0,u.textContent=`Considering the shared translation assumption.`,d.textContent=`Potential additional synthesis insight · unmeasured`,f.textContent=`Their independently reached conclusions may share one unverified translation premise. Its meaning could materially affect all three.`)}function q(){O||(O=!0,u.textContent=`Qualified synthesis · illustrative, unmeasured.`,m.dataset.answerVisible=`true`,_.setAttribute(`aria-hidden`,`false`))}function J(){D||(O||q(),D=!0,l.hidden=!1,l.open=!1)}function Y(){if(!r)return;let e=S.isEnabled()&&!F;r.setAttribute(`aria-pressed`,String(e));let t=r.querySelector(`[data-sound-label]`);t&&(t.textContent=e?`Voice ON · Turn off`:`Voice OFF · Turn on`)}function X(e=!0){R.splice(0).forEach(clearTimeout),e&&S.stop(),j=!1,a.querySelector(`[data-play-label]`).textContent=`Play H.E.R exchange`,a.setAttribute(`aria-pressed`,`false`)}function Z(e){T=e,E=e,L=-1,x?.setMode(e),m.dataset.encounterState=e,h.setAttribute(`aria-hidden`,String(e!==`listening`)),g.setAttribute(`aria-hidden`,String(e!==`consulting`&&e!==`considering`)),m.dataset.routeStep=`0`,m.dataset.secondaryRoute=`none`,m.dataset.extraSpecialist=`false`,v.setAttribute(`aria-hidden`,`true`);let t=s[e];u.textContent=t.stage,d.textContent=t.prompt,f.textContent=t.answer,y.forEach(t=>t.setAttribute(`aria-pressed`,String(t.dataset.mode===e))),m.dataset.answerVisible=`false`,_.setAttribute(`aria-hidden`,`true`),l.hidden=!0,l.open=!1,Y()}y.forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.mode;t in s&&(X(),O=!1,D=!1,k=!1,A=!1,M=!1,N=!1,P=!1,Z(t),(t===`considering`||t===`consulting`)&&V(3))})}),n.addEventListener(`click`,()=>{w=!w,B()}),C.addEventListener(`change`,B);for(let n of[e,t])n.addEventListener(`her:ring-ready`,B),n.addEventListener(`her:ring-unavailable`,B);r?.addEventListener(`click`,async()=>{if(!I){if(!F&&S.isEnabled())F=!0,S.setMuted(!0),p&&(p.textContent=`Narration muted. The illustrative encounter continues.`),Y();else{I=!0,r.disabled=!0;try{S.isEnabled()||await S.enable()?(F=!1,S.setMuted(!1),p&&(p.textContent=j?`Narration resumed at the current point.`:`Recorded voice ready. Press Play H.E.R exchange. This is a scripted study.`)):p&&(p.textContent=`Recording unsupported; the silent visual example remains available.`)}finally{I=!1,r.disabled=!1,Y()}}}}),a.addEventListener(`click`,()=>{j?X():(X(),D=!1,O=!1,k=!1,A=!1,M=!1,N=!1,P=!1,j=!0,a.setAttribute(`aria-pressed`,`true`),a.querySelector(`[data-play-label]`).textContent=`Stop`,Z(`presence`),S.isEnabled()?S.play():(R.push(setTimeout(()=>Z(`listening`),2400)),R.push(setTimeout(()=>Z(`considering`),6800)),R.push(setTimeout(()=>V(1),8150)),R.push(setTimeout(()=>V(2),11150)),R.push(setTimeout(()=>V(3),12650)),R.push(setTimeout(()=>{Z(`consulting`),V(3),H()},14650)),R.push(setTimeout(()=>{u.textContent=`Examining apparent agreement · illustrative`,d.textContent=`Hypothetical interpretations · no provider execution`,f.textContent=`The interpretations broadly agree, but one assumption deserves a closer look.`},21150)),R.push(setTimeout(()=>U(),24500)),R.push(setTimeout(()=>G(),25150)),R.push(setTimeout(()=>W(),29350)),R.push(setTimeout(()=>K(),33700)),R.push(setTimeout(()=>q(),37750)),R.push(setTimeout(()=>{J(),X(!1),a.querySelector(`[data-play-label]`).textContent=`Replay H.E.R exchange`},44150))))});let Q=()=>{document.hidden&&(X(),S.stop(),p&&(p.textContent=``)),Y()},$=e=>{e.key===`Escape`&&(X(),S.stop(),Y(),p&&(p.textContent=``))};document.addEventListener(`visibilitychange`,Q),document.addEventListener(`keydown`,$),window.addEventListener(`pagehide`,n=>{if(X(),S.stop(),Y(),p&&(p.textContent=``),!n.persisted){b?.destroy(),x?.destroy(),S.destroy(),C.removeEventListener(`change`,B);for(let n of[e,t])n.removeEventListener(`her:ring-ready`,B),n.removeEventListener(`her:ring-unavailable`,B);document.removeEventListener(`visibilitychange`,Q),document.removeEventListener(`keydown`,$)}}),B(),Y(),Z(`presence`)}function u(){let e=document.getElementById(`play-encounter`),t=document.querySelector(`.encounter-window`);e&&t&&e.addEventListener(`click`,()=>{if(!window.matchMedia(`(max-width: 800px)`).matches)return;let t=e.querySelector(`[data-play-label]`)?.textContent?.trim()??``;/^stop(?:\s|$)/i.test(t)||e.getAttribute(`aria-pressed`)===`true`||requestAnimationFrame(()=>{e.scrollIntoView({behavior:window.matchMedia(`(prefers-reduced-motion: reduce)`).matches?`auto`:`smooth`,block:`start`})})},{capture:!0})}function d(){if(typeof IntersectionObserver>`u`||window.matchMedia(`(prefers-reduced-motion: reduce)`).matches)return;let e=[...document.querySelectorAll(`main section:not(.hero) .section-kicker,main section:not(.hero) h2,main section:not(.hero) h3,#bridge .bridge-copy > p,#encounter .encounter-copy > p,.interface-section .interface-intro > p,#evolution .evolution-copy > p,#get-her .download-heading > p`)],t=new Map,n=new IntersectionObserver(e=>{for(let t of e){if(!t.isIntersecting)continue;let e=t.target;e.classList.add(`her-reveal-visible`),n.unobserve(e)}},{threshold:.08,rootMargin:`0px 0px -7% 0px`});for(let r of e){if(r.getBoundingClientRect().top<window.innerHeight*.92)continue;let e=r.closest(`section`)??document.body,i=t.get(e)??0;t.set(e,i+1),r.style.setProperty(`--her-reveal-delay`,`${Math.min(i,5)*85}ms`),r.classList.add(`her-reveal-armed`),n.observe(r)}}l(),u(),d();