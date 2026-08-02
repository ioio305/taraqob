# -*- coding: utf-8 -*-
import re
import base64

src = open('template-reference.html', encoding='utf-8').read()

FONT = re.search(r'data:font/ttf;base64,([A-Za-z0-9+/=]+)', src).group(1)
imgs = [(m.group(1), m.group(2)) for m in re.finditer(r"data:image/(webp|png);base64,([A-Za-z0-9+/=]+)", src)]
LOGO = 'data:image/png;base64,' + imgs[5][1]
def BG(i): return 'data:image/webp;base64,' + imgs[i][1]
BG_COVER = BG(6)  # الصورة الأصلية للغلاف

def PH(key):
    b = open('campus_web/%s.webp' % key, 'rb').read()
    return 'data:image/webp;base64,' + base64.b64encode(b).decode()
PH_COVER = PH('cover'); PH_QUOTE = PH('quote'); PH_DIV1 = PH('div1')
PH_DIV2 = PH('div2'); PH_STUDENTS = PH('students'); PH_CLOSING = PH('closing')

def PC(fn):
    b = open('centers_web/%s' % fn, 'rb').read()
    ext = 'png' if fn.endswith('.png') else 'webp'
    return 'data:image/%s;base64,' % ext + base64.b64encode(b).decode()
CEN1 = PC('c1.webp'); CEN2 = PC('c2.webp'); CEN3 = PC('c3.webp')
CEN4 = PC('c4.webp'); CEN5 = PC('c5.webp'); CEN6 = PC('c6.webp')
ACCRED = PC('accred.png')
PARTNERS = PC('partners.png')
LOGO_ASIS = PC('asis.webp'); LOGO_INTERPOL = PC('interpol.webp')
LOGO_ACCET = PC('accet.webp'); LOGO_ACCREDITED = PC('accredited.webp')

def IC(body):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"'
            ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % body)

IC_EYE = IC('<path d="M2 12s3.6-6.8 10-6.8S22 12 22 12s-3.6 6.8-10 6.8S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>')
IC_TARGET = IC('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>')
IC_LAYERS = IC('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12.5l9 5 9-5"/><path d="M3 17l9 5 9-5"/>')
IC_CITY = IC('<path d="M3 21h18"/><path d="M5 21V9l4-2.5V21"/><path d="M9 21V4l6 3v14"/><path d="M15 21v-8l4 1.5V21"/><path d="M11.5 9.5h1.5M11.5 13.5h1.5M7 11.5h1M7 15.5h1"/>')
IC_GLOBE = IC('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3.2 3.6 3.2 14.4 0 18"/><path d="M12 3c-3.2 3.6-3.2 14.4 0 18"/>')
IC_COMPASS = IC('<circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3z"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>')
IC_SHIELD = IC('<path d="M12 3l7 2.8v5.4c0 4.8-3.3 7.7-7 9.8-3.7-2.1-7-5-7-9.8V5.8L12 3z"/><path d="M9 11.8l2.2 2.2 4.3-4.3"/>')
IC_MEDAL = IC('<circle cx="12" cy="9" r="5"/><path d="M9.6 8.8l1.7 1.7 3-3"/><path d="M8.6 13.4L7 21l5-2.6L17 21l-1.6-7.6"/>')
IC_GEAR = IC('<circle cx="12" cy="12" r="3.4"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5 5l1.9 1.9M17.1 17.1L19 19M19 5l-1.9 1.9M6.9 17.1L5 19"/>')
IC_BARS = IC('<path d="M3 21h18"/><path d="M6.5 21v-6"/><path d="M11 21V8"/><path d="M15.5 21v-9"/><path d="M20 21V4"/>')

html = r"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width,initial-scale=1,viewport-fit=cover" name="viewport"/>
<meta content="#061216" name="theme-color"/>
<title>كيف نقود مستقبل الأمن في ظل التحديات المستقبلية؟ | العرض التفاعلي</title>
<style>
@font-face{font-family:"El Messiri Local";src:url("data:font/ttf;base64,%%FONT%%")}
:root{
  --green:#2a6364;--green-2:#4f8f7a;--gold:#c7b08c;--ink:#061216;
  --white:#f9f9f9;--line:rgba(199,176,140,.35);--shadow:0 24px 70px rgba(0,0,0,.36);
}
*{box-sizing:border-box}
html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#030b0e;color:var(--white);font-family:"El Messiri Local","El Messiri",Tahoma,Arial,sans-serif}
button{font:inherit}
button:focus-visible{outline:3px solid var(--gold);outline-offset:4px}
#app{position:fixed;inset:0;background:radial-gradient(circle at 50% 45%,#123a3d 0%,#07171b 48%,#03090c 100%)}
#deck{position:absolute;left:50%;top:50%;width:1600px;height:900px;transform-origin:center center;will-change:transform;overflow:hidden;border-radius:18px;background:#07171b;box-shadow:0 30px 100px rgba(0,0,0,.58),0 0 0 1px rgba(255,255,255,.06)}
.slide{position:absolute;inset:0;opacity:0;visibility:hidden;pointer-events:none;transform:translate3d(2.6%,0,0) scale(.985);transition:opacity .55s ease,transform .65s cubic-bezier(.2,.8,.2,1),visibility .55s;overflow:hidden}
.slide.active{opacity:1;visibility:visible;pointer-events:auto;transform:translate3d(0,0,0) scale(1);z-index:2}
.slide.prev{transform:translate3d(-2.6%,0,0) scale(.985)}
.slide::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,10,13,.88) 0%,rgba(2,10,13,.6) 48%,rgba(2,10,13,.8) 100%);pointer-events:none}
.slide-bg{position:absolute;inset:-2%;background-size:cover;background-position:center;filter:saturate(.5) contrast(.96) brightness(.55);opacity:.8;transform:scale(1.04);transition:transform 8s ease}
.slide.active .slide-bg{transform:scale(1.0)}
.slide-bg::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 56% 42%,transparent 0%,rgba(3,12,15,.15) 38%,rgba(3,12,15,.78) 100%)}
.slide-content{position:relative;z-index:3;width:100%;height:100%;padding:106px 86px 84px;display:flex;flex-direction:column}
.slide-number{position:absolute;bottom:30px;left:36px;width:58px;height:58px;border:1px solid rgba(199,176,140,.65);border-radius:50%;display:grid;place-items:center;color:var(--gold);font-size:18px;background:rgba(2,12,15,.5);z-index:6}
.brand-mini{position:absolute;top:20px;right:24px;z-index:20;width:190px;height:64px;display:flex;align-items:center;justify-content:flex-end;pointer-events:none}
.brand-mini img{width:190px;height:auto;max-height:64px;object-fit:contain;object-position:right center;filter:drop-shadow(0 8px 18px rgba(0,0,0,.30))}
body:has(.cover.active) .brand-mini{opacity:0}
.kicker{color:var(--gold);font-size:20px;letter-spacing:.05em;margin-bottom:12px}
.h1{font-size:54px;line-height:1.25;margin:0;color:#fff;font-weight:700;text-shadow:0 8px 28px rgba(0,0,0,.36)}
.h2{font-size:39px;line-height:1.26;margin:0 0 22px;font-weight:700}
.h3{font-size:25px;line-height:1.45;margin:0 0 12px;color:#fff;font-weight:600}
.lead{font-size:22px;line-height:1.78;margin:0;color:#f1f5f5}
.body{font-size:19px;line-height:1.82;margin:0;color:#eef4f4}
.small{font-size:17.5px;line-height:1.82}
.glass{background:linear-gradient(145deg,rgba(5,22,26,.92),rgba(7,30,34,.84));border:1px solid rgba(199,176,140,.28);box-shadow:var(--shadow);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:28px}
.title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:34px;margin-bottom:24px}
.title-row .rule{height:2px;flex:1;background:linear-gradient(90deg,transparent,rgba(199,176,140,.65),transparent);margin-top:26px}
.accent{color:var(--gold)}
.section-label{display:inline-flex;align-items:center;gap:10px;color:#ead9b9;font-size:23px;line-height:1.45;font-weight:700;margin-bottom:16px}
.section-label::before{content:"";width:38px;height:2px;background:var(--gold)}
.panel{padding:30px 34px;position:relative;overflow:hidden}
.panel::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:linear-gradient(180deg,var(--gold),transparent)}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:26px;min-height:0;flex:1}
/* الغلاف */
.cover::after{background:linear-gradient(90deg,rgba(1,10,13,.94) 0%,rgba(1,10,13,.74) 42%,rgba(1,10,13,.14) 74%,rgba(1,10,13,.34) 100%)}
.cover .slide-bg{filter:saturate(.92) contrast(1.04);opacity:1}
.cover .slide-content{justify-content:center;padding-right:102px;width:68%}
.cover-brand{display:flex;align-items:center;margin-bottom:26px}
.cover-brand img{width:430px;height:auto;max-height:160px;object-fit:contain;object-position:right center;filter:drop-shadow(0 12px 28px rgba(0,0,0,.34))}
.cover h1{font-size:56px;margin:10px 0 20px}
.cover .subtitle{font-size:26px;line-height:1.65;color:#f2eee6;max-width:900px}
.start-btn{display:inline-flex;align-items:center;gap:18px;margin-top:34px;color:#fff;border:1px solid rgba(199,176,140,.45);background:rgba(4,18,22,.46);padding:16px 26px;border-radius:24px;cursor:pointer;text-align:right;font-size:20px;transition:.25s}
.start-btn:hover{border-color:var(--gold);background:rgba(42,99,100,.34)}
.start-btn strong{font-size:26px;color:var(--gold)}
/* الفهرس التفاعلي */
.agenda-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;flex:1;min-height:0}
.agenda-card{border:1px solid rgba(199,176,140,.24);border-radius:24px;background:rgba(5,23,27,.8);color:#fff;padding:26px 26px;cursor:pointer;text-align:right;display:flex;flex-direction:column;gap:10px;transition:.3s}
.agenda-card:hover{transform:translateY(-6px);border-color:var(--gold);background:rgba(42,99,100,.4)}
.agenda-card .an{color:var(--gold);font-size:16px}
.agenda-card strong{font-size:23px;line-height:1.45}
.agenda-card span{font-size:16px;line-height:1.65;color:#dbe4e4}
.agenda-card .go{margin-top:auto;align-self:flex-start;color:#d7c29e;font-size:15px;border:1px solid rgba(199,176,140,.4);border-radius:999px;padding:5px 14px}
/* الاقتباس */
.quote-panel{padding:56px 64px;font-size:31px;line-height:2.05;color:#f4f7f6}
.quote-panel .qmark{font-size:90px;color:var(--gold);line-height:.4;display:block;margin-bottom:26px}
.mission-band{margin-top:28px;display:flex;align-items:center;justify-content:center;gap:20px;padding:26px 40px;font-size:30px;font-weight:700;color:#fff}
.mission-band .accent{font-size:34px}
/* بطاقات مرقمة */
.cards5{display:grid;grid-template-columns:1fr;gap:13px;min-height:0}
.num-card{display:flex;align-items:center;gap:18px;border:1px solid rgba(199,176,140,.22);border-radius:20px;background:rgba(5,23,27,.78);padding:15px 22px}
.num-card .n{flex:0 0 auto;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.5);color:var(--gold);background:rgba(3,15,18,.66);font-size:18px}
.num-card p{margin:0;font-size:18.5px;line-height:1.65}
/* أرقام كبرى */
.stats-row{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;flex:1;min-height:0}
.stat-big{padding:38px 32px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:18px}
.stat-big strong{font-size:92px;color:var(--gold);line-height:1}
.stat-big .lbl{font-size:24px;color:#fff;font-weight:700}
.stat-big p{font-size:17.5px;line-height:1.8;margin:0;color:#e7eeed}
/* التحولات الكبرى: مشهد الاندماج */
.fusion{display:flex;flex-direction:column;justify-content:space-between;flex:1;min-height:0}
.f-row{display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
.f-chip{display:flex;align-items:center;gap:12px;border:1px solid rgba(199,176,140,.28);border-radius:999px;background:rgba(5,23,27,.85);padding:11px 20px;font-size:17.5px;line-height:1.5;box-shadow:0 14px 30px rgba(0,0,0,.3);animation:riseIn .6s cubic-bezier(.2,.8,.2,1) both,floatY 7s ease-in-out infinite alternate;animation-delay:var(--fd,.05s),calc(var(--fd,.05s) + 1.3s)}
.f-chip .n{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.5);color:var(--gold);background:rgba(3,15,18,.66);font-size:14px}
.f-row .f-chip:nth-child(1){--fd:.05s}.f-row .f-chip:nth-child(2){--fd:.17s}.f-row .f-chip:nth-child(3){--fd:.29s}
.f-row.bottom .f-chip:nth-child(1){--fd:1.35s}.f-row.bottom .f-chip:nth-child(2){--fd:1.47s}.f-row.bottom .f-chip:nth-child(3){--fd:1.59s}
@keyframes floatY{from{transform:translateY(-7px)}to{transform:translateY(7px)}}
.f-core{position:relative;display:flex;align-items:center;justify-content:center;gap:30px;padding:6px 0}
.f-core::before{content:"";position:absolute;top:50%;right:9%;left:9%;height:3px;transform:translateY(-50%);border-radius:2px;background:repeating-linear-gradient(90deg,rgba(199,176,140,.65) 0 14px,transparent 14px 27px);animation:dashMove 1.1s linear infinite}
@keyframes dashMove{to{background-position:-27px 0}}
.f-core>*{position:relative;z-index:1}
.f-orb{width:172px;height:172px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;border:1px solid rgba(199,176,140,.5);background:radial-gradient(circle at 35% 30%,rgba(199,176,140,.22),rgba(5,22,26,.97) 68%);font-size:19.5px;font-weight:700;line-height:1.45;padding:18px;box-shadow:0 20px 46px rgba(0,0,0,.36);animation:riseIn .7s cubic-bezier(.2,.8,.2,1) both,floatY 8s ease-in-out infinite alternate;animation-delay:.45s,1.9s}
.f-orb.o2{animation-delay:.62s,2.1s}
.f-orb .ic{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.45);color:#e9d8b8;background:radial-gradient(circle at 32% 28%,rgba(199,176,140,.3),rgba(42,99,100,.5) 55%,rgba(4,18,22,.9))}
.f-orb .ic svg{width:26px;height:26px}
.f-sym{font-size:46px;color:var(--gold);font-weight:700;text-shadow:0 0 22px rgba(199,176,140,.4);animation:bob 3s ease-in-out infinite}
.f-sym.s2{animation-delay:1.2s}
@keyframes bob{0%,100%{transform:translateY(-4px)}50%{transform:translateY(4px)}}
.f-result{position:relative;width:206px;height:206px;border-radius:50%;display:grid;place-items:center;text-align:center;background:radial-gradient(circle at 40% 30%,#efe0bd,#c7b08c 52%,#937f57 100%);color:#0d1c17;font-size:26px;font-weight:800;line-height:1.4;padding:26px;box-shadow:0 0 70px rgba(199,176,140,.35),0 22px 50px rgba(0,0,0,.4);animation:scaleIn .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:1.05s}
.f-result::before,.f-result::after{content:"";position:absolute;inset:-6px;border:1px solid rgba(199,176,140,.55);border-radius:50%;animation:ringPulse 3s ease-out infinite;pointer-events:none}
.f-result::after{animation-delay:1.5s}
@keyframes scaleIn{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@keyframes ringPulse{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.45);opacity:0}}
.f-caption{align-self:center;border:1px solid rgba(199,176,140,.4);border-radius:999px;background:rgba(4,18,22,.66);color:#ead9b9;font-size:19px;font-weight:600;padding:10px 30px;animation:riseIn .6s ease both;animation-delay:1.5s}
/* الفواصل */
.divider .slide-content{justify-content:center;align-items:flex-start;width:75%}
.divider .h1{font-size:64px}
.divider .subtitle{font-size:27px;line-height:1.7;color:#f2eee6;margin-top:18px}
/* البوصلة */
.compass-layout{display:grid;grid-template-columns:.95fr 1.05fr;gap:34px;align-items:center;flex:1;min-height:0}
.compass{position:relative;width:540px;height:540px;margin:auto;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.35)}
.compass::before{content:"";position:absolute;inset:54px;border-radius:50%;border:1px dashed rgba(79,143,122,.4)}
.compass-hub{width:180px;height:180px;border-radius:50%;display:grid;place-items:center;text-align:center;background:rgba(5,20,24,.88);border:1px solid rgba(199,176,140,.55);font-size:21px;line-height:1.6;padding:22px}
.compass-node{position:absolute;width:168px;min-height:82px;border-radius:22px;border:1px solid rgba(199,176,140,.3);background:rgba(5,23,27,.94);color:#fff;padding:12px 14px;text-align:center;font-size:16.5px;line-height:1.5;cursor:pointer;transition:.3s;box-shadow:0 16px 34px rgba(0,0,0,.28)}
.compass-node small{display:block;color:#d7c29e;font-size:13px;margin-top:4px}
.compass-node:hover,.compass-node.active{transform:scale(1.06);border-color:var(--gold);background:rgba(9,35,39,.95);box-shadow:0 0 0 6px rgba(199,176,140,.08),0 18px 40px rgba(0,0,0,.34)}
.compass-node.c1{top:-12px;right:56px}.compass-node.c2{right:-48px;top:229px}.compass-node.c3{bottom:-12px;right:56px}.compass-node.c4{bottom:-12px;left:56px}.compass-node.c5{left:-48px;top:229px}.compass-node.c6{top:-12px;left:56px}
.compass-hint{position:absolute;bottom:-46px;right:50%;transform:translateX(50%);font-size:15px;color:#d7c29e;white-space:nowrap}
.cap-detail{padding:32px 38px;min-height:340px;display:flex;flex-direction:column;justify-content:center}
.cap-detail .cap-index{color:var(--gold);font-size:17px;margin-bottom:6px}
.cap-detail h3{color:#fff;font-size:29px;margin:0 0 16px}
.cap-detail ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.cap-detail li{position:relative;padding-right:24px;font-size:19px;line-height:1.7}
.cap-detail li::before{content:"";position:absolute;right:0;top:.75em;width:9px;height:9px;border-radius:50%;background:var(--gold)}
.cap-shift{margin-top:18px;padding:14px 20px;border-radius:16px;background:rgba(42,99,100,.28);border:1px solid rgba(199,176,140,.3);color:#ead9b9;font-size:19px;font-weight:600}
.cap-progress{display:flex;gap:8px;margin-top:20px}
.cap-progress span{width:34px;height:4px;border-radius:2px;background:rgba(255,255,255,.15)}
.cap-progress span.active{background:var(--gold)}
/* مسار القرار */
.path-flow{display:flex;align-items:stretch;gap:0;flex:1;min-height:0;align-content:center;margin-top:10px;position:relative}
.path-flow::before{content:"";position:absolute;top:50%;right:7%;left:7%;height:2px;background:linear-gradient(90deg,transparent,rgba(199,176,140,.5) 18%,rgba(199,176,140,.5) 82%,transparent);transform:translateY(-50%)}
.path-step{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:20px 8px;position:relative;z-index:1}
.path-step .circle{width:118px;height:118px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.55);background:rgba(4,18,22,.86);font-size:19px;font-weight:700;line-height:1.4;padding:12px;box-shadow:0 18px 44px rgba(0,0,0,.3);transition:.3s}
.path-step:hover .circle{border-color:var(--gold);transform:translateY(-6px)}
.path-step .sn{color:var(--gold);font-size:16px}
.path-arrow{align-self:center;color:var(--gold);font-size:30px;padding:0 2px;z-index:1;position:relative}
.path-final .circle{background:radial-gradient(circle,rgba(42,99,100,.9),rgba(5,20,24,.95));border-color:var(--gold);color:#fff}
/* مقارنة */
.vs-grid{display:grid;grid-template-columns:1fr auto 1fr;gap:22px;align-items:center;flex:1;min-height:0}
.vs-card{padding:32px 38px;display:flex;flex-direction:column;justify-content:center;text-align:center;gap:12px;align-self:center}
.vs-card .ic{width:68px;height:68px;margin:0 auto;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.5);color:#e9d8b8;background:radial-gradient(circle at 32% 28%,rgba(199,176,140,.3),rgba(42,99,100,.5) 55%,rgba(4,18,22,.9));box-shadow:0 12px 26px rgba(0,0,0,.32),inset 0 2px 8px rgba(255,255,255,.12)}
.vs-card .ic svg{width:32px;height:32px}
.vs-card h3{font-size:28px;margin:0}
.vs-card.old h3{color:#9fb3b2}.vs-card.new h3{color:var(--gold)}
.vs-card p{font-size:19px;line-height:1.85;margin:0}
.vs-mid{align-self:center;font-size:44px;color:var(--gold)}
/* التبويبات */
.tabs-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.tabs-bar button{border:1px solid rgba(199,176,140,.28);background:rgba(5,23,27,.68);color:#e9f0ef;border-radius:999px;padding:11px 20px;cursor:pointer;transition:.25s;font-size:18px}
.tabs-bar button.active,.tabs-bar button:hover{background:rgba(42,99,100,.56);border-color:var(--gold);color:#fff}
.tabs-bar button .tn{color:var(--gold);margin-left:8px;font-size:15px}
.tabpane{display:none;flex:1;min-height:0}
.tabpane.active{display:flex;animation:fadeUp .35s ease}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.tabpane .panel{flex:1;display:flex;flex-direction:column;justify-content:center;overflow:auto}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.chip{border:1px solid rgba(199,176,140,.32);background:rgba(4,18,22,.6);color:#ead9b9;border-radius:999px;padding:8px 18px;font-size:16.5px}
/* المقررات */
.course-list{display:grid;gap:14px}
.course{border:1px solid rgba(199,176,140,.24);border-radius:18px;background:rgba(4,18,22,.62);padding:17px 24px;display:flex;flex-direction:column;gap:5px}
.course strong{font-size:20.5px;line-height:1.5;color:#fff}
.course .en{font-size:14.5px;color:#a9bcbb;direction:ltr;text-align:right;line-height:1.5}
/* رحلة البحث: المسار الصاعد */
.journey{position:relative;flex:1;min-height:0}
.j-svg{position:absolute;inset:0;width:100%;height:100%}
.j-svg path{stroke:rgba(199,176,140,.6);stroke-width:2.5;fill:none;stroke-dasharray:12 14;animation:jDash 1.3s linear infinite}
@keyframes jDash{to{stroke-dashoffset:-26}}
.j-node{position:absolute;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.65);background:radial-gradient(circle at 35% 30%,rgba(199,176,140,.28),rgba(4,18,22,.95) 70%);color:var(--gold);font-size:16px;font-weight:700;box-shadow:0 14px 30px rgba(0,0,0,.35);animation:riseIn .55s cubic-bezier(.2,.8,.2,1) both,jGlow 3.2s ease-in-out infinite;animation-delay:var(--jd,.05s),calc(var(--jd,.05s) + 1.6s)}
.j-node.fut{width:94px;border-radius:999px;font-size:14.5px;background:radial-gradient(circle at 40% 30%,#efe0bd,#c7b08c 55%,#937f57);color:#0d1c17;border-color:rgba(199,176,140,.9)}
@keyframes jGlow{0%,100%{box-shadow:0 14px 30px rgba(0,0,0,.35),0 0 0 0 rgba(199,176,140,.3)}50%{box-shadow:0 14px 30px rgba(0,0,0,.35),0 0 0 12px rgba(199,176,140,0)}}
.j-card{position:absolute;width:212px;border:1px solid rgba(199,176,140,.26);border-radius:18px;background:rgba(5,23,27,.88);padding:14px 16px;box-shadow:0 16px 36px rgba(0,0,0,.32);display:flex;flex-direction:column;gap:6px;animation:riseIn .55s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--jc,.2s);transition:transform .3s ease,border-color .3s ease}
.j-card:hover{transform:translateY(-5px);border-color:rgba(199,176,140,.6)}
.j-card strong{font-size:17.5px;color:#fff}
.j-card p{margin:0;font-size:13.5px;line-height:1.65;color:#cfdbda}
.j-card .j-hl{color:var(--gold);font-weight:700}
.j-card .j-stat{align-self:flex-start;margin-top:2px;border:1px solid rgba(199,176,140,.4);border-radius:999px;background:rgba(3,15,18,.6);color:#ead9b9;font-size:13px;font-weight:700;padding:3px 11px}
.j-card.fut{border-color:rgba(199,176,140,.6);background:rgba(42,99,100,.34)}
.j-st1{right:3%;bottom:4%}.j-st2{right:19.6%;bottom:20%}.j-st3{right:36.3%;bottom:36%}
.j-st4{right:53%;bottom:52%}.j-st5{right:69.6%;bottom:68%}.j-st6{right:86.3%;bottom:84%}
.j-c1{right:1%;bottom:21%}.j-c2{right:17%;bottom:37%}.j-c3{right:33%;bottom:53%}
.j-c4{right:47%;bottom:8%}.j-c5{right:63%;bottom:24%}.j-c6{right:79%;bottom:40%}
.j-c1{--jc:.18s}.j-c2{--jc:.4s}.j-c3{--jc:.62s}.j-c4{--jc:.84s}.j-c5{--jc:1.06s}.j-c6{--jc:1.28s}
.j-st1{--jd:.06s}.j-st2{--jd:.28s}.j-st3{--jd:.5s}.j-st4{--jd:.72s}.j-st5{--jd:.94s}.j-st6{--jd:1.16s}
.j-card{cursor:pointer}
/* العرض المكبر للبطاقة */
#jzoom{position:absolute;inset:0;z-index:70;display:none;align-items:center;justify-content:center;background:rgba(2,10,13,.84);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
#jzoom.open{display:flex;animation:fadeUp .25s ease}
.jzoom-card{max-width:780px;padding:44px 56px 34px;text-align:center;border-radius:30px;background:linear-gradient(145deg,rgba(5,22,26,.97),rgba(7,30,34,.93));border:1px solid rgba(199,176,140,.5);box-shadow:0 30px 90px rgba(0,0,0,.55)}
.jzoom-year{display:inline-block;margin-bottom:18px;color:var(--gold);border:1px solid rgba(199,176,140,.6);border-radius:999px;padding:6px 24px;font-size:20px;font-weight:700;background:rgba(3,15,18,.65)}
.jzoom-body h3,.jzoom-body strong{display:block;font-size:34px;margin:0 0 16px;color:#fff;font-weight:700}
.jzoom-body p{font-size:22.5px;line-height:1.9;margin:0;color:#eef4f4}
.jzoom-body .j-hl{color:var(--gold);font-weight:700}
.jzoom-body .j-stat{display:inline-block;margin-top:22px;border:1px solid rgba(199,176,140,.55);border-radius:999px;background:rgba(3,15,18,.65);color:#ead9b9;font-size:20px;font-weight:700;padding:8px 24px}
.jzoom-hint{margin-top:24px;font-size:14.5px;color:#9fb3b2}
/* دفعات */
.batch-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;flex:1;min-height:0}
.batch-card{border:1px solid rgba(199,176,140,.24);border-radius:22px;background:rgba(5,23,27,.8);padding:18px 16px;display:flex;flex-direction:column;justify-content:center;gap:8px;text-align:center;transition:.25s}
.batch-card:hover{transform:translateY(-5px);border-color:var(--gold)}
.batch-card .bn{color:var(--gold);font-size:16px}
.batch-card strong{font-size:21px;color:#fff}
.batch-card span{font-size:16px;color:#dbe4e4}
.bchips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:2px}
.bchip{border:1px solid rgba(199,176,140,.3);background:rgba(3,15,18,.55);color:#d8c9a8;border-radius:999px;padding:3px 11px;font-size:12.5px;line-height:1.6}
/* وحدات تدريبية */
.unit-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;flex:1;min-height:0}
.unit-card{border:1px solid rgba(199,176,140,.24);border-radius:22px;background:rgba(5,23,27,.8);padding:22px;display:flex;flex-direction:column;gap:8px;transition:.25s}
.unit-card:hover{transform:translateY(-5px);border-color:var(--gold)}
.unit-card .un{color:var(--gold);font-size:15px}
.unit-card strong{font-size:20px;line-height:1.5;color:#fff}
.unit-card .en{font-size:13.5px;color:#a9bcbb;direction:ltr;text-align:right;line-height:1.5}
.unit-card .dur{margin-top:auto;align-self:flex-start;border:1px solid rgba(199,176,140,.4);border-radius:999px;padding:5px 15px;font-size:15px;color:#ead9b9;background:rgba(3,15,18,.6)}
/* ثلاث بطاقات */
.three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;flex:1;min-height:0;align-items:center}
.feature-card{padding:30px 28px;display:flex;flex-direction:column;justify-content:center;text-align:center;gap:14px;align-self:center}
.feature-card .ic{width:86px;height:86px;margin:0 auto;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(199,176,140,.55);color:#f4e6c8;background:radial-gradient(circle at 32% 28%,rgba(199,176,140,.34),rgba(42,99,100,.55) 55%,rgba(4,18,22,.92));box-shadow:0 14px 30px rgba(0,0,0,.35),inset 0 2px 8px rgba(255,255,255,.14)}
.feature-card .ic svg{width:40px;height:40px}
.feature-card h3{font-size:24px;margin:0}
.feature-card p{font-size:17.5px;line-height:1.8;margin:0;color:#e7eeed}
/* تبويب مركز بصورة */
.cen-pane{display:grid;grid-template-columns:.92fr 1.08fr;gap:28px;align-items:center;flex:1;min-height:0}
.cen-img{height:100%;max-height:430px;border-radius:24px;overflow:hidden;border:1px solid rgba(199,176,140,.38);box-shadow:0 22px 50px rgba(0,0,0,.4);position:relative}
.cen-img::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);border-radius:24px;pointer-events:none}
.cen-img img{width:100%;height:100%;object-fit:cover;display:block}
/* شريط شعارات الاعتماد */
.accred-band{margin-top:14px;padding:12px 30px;display:flex;align-items:center;justify-content:center}
.accred-band img{width:100%;max-width:1180px;max-height:320px;object-fit:contain;display:block}
.three-col.compact{align-items:start}
.three-col.compact .feature-card{padding:20px 24px;gap:8px}
.three-col.compact .feature-card .ic{width:60px;height:60px}
.three-col.compact .feature-card .ic svg{width:28px;height:28px}
.three-col.compact .feature-card h3{font-size:20px}
.three-col.compact .feature-card p{font-size:15px;line-height:1.7}
/* تبويبات الاعتماد */
.logo-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;flex:1;min-height:0;align-items:center}
.logo-card{display:grid;place-items:center;padding:28px 22px;min-height:240px;transition:transform .3s ease,border-color .3s ease}
.logo-card:hover{transform:translateY(-6px);border-color:rgba(199,176,140,.6)}
.logo-card img{max-width:100%;max-height:210px;object-fit:contain;display:block}
.logo-pane{display:grid;place-items:center;padding:22px 30px}
.logo-pane img{max-width:100%;max-height:440px;object-fit:contain;display:block}
/* قوائم برامج الكليات */
.lo-list{display:grid;gap:8px}
.lo{display:flex;align-items:center;border:1px solid rgba(199,176,140,.22);border-radius:14px;background:rgba(4,18,22,.55);padding:8px 18px;transition:.25s}
.lo:hover{border-color:rgba(199,176,140,.55);background:rgba(8,35,39,.8)}
.lo strong{font-size:15px;font-weight:500;line-height:1.6;color:#eef4f4}
.prog-list{display:grid;gap:8px}
.prog-list.two{grid-template-columns:1fr 1fr}
.prog{display:flex;align-items:center;justify-content:space-between;gap:14px;border:1px solid rgba(199,176,140,.22);border-radius:14px;background:rgba(4,18,22,.55);padding:9px 18px;transition:.25s}
.prog:hover{border-color:rgba(199,176,140,.55);background:rgba(8,35,39,.8)}
.prog strong{font-size:16.5px;font-weight:600;line-height:1.5;color:#fff}
.pdept{flex:0 0 auto;font-size:12.5px;color:#d8c9a8;border:1px solid rgba(199,176,140,.3);border-radius:999px;padding:3px 12px;background:rgba(3,15,18,.5);white-space:nowrap}
/* إنجاز */
.achieve-band{display:flex;align-items:center;gap:24px;padding:24px 34px;margin-top:18px}
.achieve-band strong{font-size:64px;color:var(--gold);line-height:1;flex:0 0 auto}
.achieve-band p{margin:0;font-size:20px;line-height:1.8}
/* الختام */
.closing-cover .slide-bg{filter:saturate(.72) brightness(.58) contrast(1.04);opacity:1}
.closing-cover::after{background:none}
.closing-cover::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,rgba(42,99,100,.20),transparent 34%),linear-gradient(90deg,rgba(3,14,17,.78),rgba(3,14,17,.4) 48%,rgba(3,14,17,.78));z-index:1}
.closing-cover .slide-content{z-index:2;display:grid;grid-template-rows:auto 1fr auto;height:100%;padding:54px 72px 62px;width:100%;justify-content:normal}
.closing-top .cover-brand{margin:0}.closing-top .cover-brand img{width:172px;height:172px}
.closing-main{align-self:center;justify-self:end;margin-left:3%;text-align:center;max-width:660px;position:relative}
.closing-main::before,.closing-main::after{content:"";position:absolute;inset:50% auto auto 50%;border:1px solid rgba(199,176,140,.26);border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.closing-main::before{width:560px;height:560px}.closing-main::after{width:420px;height:420px;border-color:rgba(79,143,122,.30)}
.closing-main .closing-kicker{position:relative;z-index:1;color:var(--gold);font-size:22px;margin-bottom:20px}
.closing-main h2{position:relative;z-index:1;font-size:46px;line-height:1.6;margin:0 0 22px;color:#fff;font-weight:700}
.closing-main p{position:relative;z-index:1;font-size:28px;line-height:1.7;color:#eef3f2;margin:0 auto}
.closing-actions{position:relative;z-index:1;display:flex;justify-content:center;gap:14px;margin-top:36px}
.closing-actions button{border:1px solid rgba(199,176,140,.55);background:rgba(5,23,27,.68);color:#fff;border-radius:999px;padding:13px 24px;font:inherit;font-size:18px;cursor:pointer;transition:.25s}
.closing-actions button:hover{background:rgba(42,99,100,.72);transform:translateY(-2px)}
.closing-footer{display:flex;align-items:center;justify-content:space-between;color:#d8e1df;font-size:18px}
/* التحكم */
#controls{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:50;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:999px;background:rgba(3,14,17,.78);border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(12px);direction:ltr}
.ctrl{width:42px;height:42px;border:1px solid rgba(199,176,140,.32);border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.04);color:#fff;cursor:pointer;transition:.2s}
.ctrl:hover{background:rgba(199,176,140,.18);border-color:var(--gold)}
#counter{min-width:78px;text-align:center;color:#dce7e6;font-size:16px;direction:ltr}
#progress{position:absolute;bottom:0;right:0;height:4px;background:linear-gradient(90deg,var(--green-2),var(--gold));z-index:55;transition:width .45s ease}
#menu{position:absolute;inset:0;z-index:80;background:rgba(2,10,13,.96);display:none;padding:74px 80px 70px;overflow:auto}
#menu.open{display:block;animation:fadeUp .3s ease}
.menu-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.menu-head h2{font-size:36px;margin:0}
.menu-close{border:1px solid rgba(199,176,140,.45);background:transparent;color:#fff;border-radius:999px;padding:10px 18px;cursor:pointer}
.menu-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.menu-item{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.035);color:#fff;border-radius:20px;padding:18px;text-align:right;cursor:pointer;min-height:110px;transition:.25s}
.menu-item:hover,.menu-item.active{border-color:var(--gold);background:rgba(42,99,100,.25);transform:translateY(-3px)}
.menu-item .mn{color:var(--gold);font-size:15px}
.menu-item .mt{font-size:17px;line-height:1.6;margin-top:8px}
#toast{position:absolute;top:22px;left:50%;transform:translateX(-50%) translateY(-20px);z-index:100;padding:10px 18px;border-radius:999px;background:rgba(3,14,17,.9);border:1px solid rgba(199,176,140,.35);opacity:0;pointer-events:none;transition:.3s;font-size:15px}
#toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
/* ===== الحيوية والحركة ===== */
.aura{position:absolute;border-radius:50%;filter:blur(110px);opacity:.2;pointer-events:none;z-index:1}
.aura.a1{width:580px;height:580px;background:#2a6364;top:-170px;left:-130px;animation:drift1 14s ease-in-out infinite alternate}
.aura.a2{width:460px;height:460px;background:#c7b08c;bottom:-180px;right:-110px;opacity:.1;animation:drift2 18s ease-in-out infinite alternate}
@keyframes drift1{to{transform:translate(70px,50px) scale(1.15)}}
@keyframes drift2{to{transform:translate(-60px,-40px) scale(1.12)}}
@keyframes riseIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.rise,.rise-seq>*{opacity:0}
.slide.active .rise{animation:riseIn .6s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--rd,.08s)}
.slide.active .rise-seq>*{animation:riseIn .55s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:var(--rd,0s)}
.rise-seq>*:nth-child(1){--rd:.03s}.rise-seq>*:nth-child(2){--rd:.1s}.rise-seq>*:nth-child(3){--rd:.17s}.rise-seq>*:nth-child(4){--rd:.24s}.rise-seq>*:nth-child(5){--rd:.31s}.rise-seq>*:nth-child(6){--rd:.38s}.rise-seq>*:nth-child(7){--rd:.45s}.rise-seq>*:nth-child(8){--rd:.52s}
.path-flow.rise-seq>*:nth-child(1){--rd:.06s}.path-flow.rise-seq>*:nth-child(2){--rd:.18s}.path-flow.rise-seq>*:nth-child(3){--rd:.3s}.path-flow.rise-seq>*:nth-child(4){--rd:.42s}.path-flow.rise-seq>*:nth-child(5){--rd:.54s}.path-flow.rise-seq>*:nth-child(6){--rd:.66s}.path-flow.rise-seq>*:nth-child(7){--rd:.78s}.path-flow.rise-seq>*:nth-child(8){--rd:.9s}.path-flow.rise-seq>*:nth-child(9){--rd:1.02s}.path-flow.rise-seq>*:nth-child(10){--rd:1.14s}.path-flow.rise-seq>*:nth-child(11){--rd:1.26s}
@keyframes pulseGold{0%,100%{box-shadow:0 18px 44px rgba(0,0,0,.3),0 0 0 0 rgba(199,176,140,.35)}50%{box-shadow:0 18px 44px rgba(0,0,0,.3),0 0 0 16px rgba(199,176,140,0)}}
.slide.active .path-final .circle{animation:pulseGold 2.6s ease-in-out infinite}
@keyframes glowLine{0%,100%{opacity:.5}50%{opacity:1}}
.slide.active .title-row .rule{animation:glowLine 3s ease-in-out infinite}
.num-card,.shift-card,.unit-card,.batch-card{transition:transform .3s ease,border-color .3s ease,background .3s ease}
.num-card:hover,.shift-card:hover{transform:translateX(-6px);border-color:rgba(199,176,140,.6);background:rgba(8,35,39,.88)}
.feature-card{transition:transform .3s ease,border-color .3s ease}
.feature-card:hover{transform:translateY(-6px);border-color:rgba(199,176,140,.6)}
.chip{transition:.25s}
.chip:hover{border-color:var(--gold);background:rgba(42,99,100,.4);transform:translateY(-3px)}
/* خلفيات حية بحركة بطيئة */
.slide-bg.kenburns{transition:none}
.slide.active .slide-bg.kenburns{animation:kenburns 26s ease-in-out infinite alternate}
@keyframes kenburns{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.12) translate(-1.5%,-1%)}}
.cover .slide-bg.kenburns{filter:saturate(1.0) contrast(1.05) brightness(.9);opacity:1}
@media (max-width:900px) and (orientation:portrait){
  html,body{overflow:auto;background:#061216}
  #app{position:relative;min-height:100svh;overflow:hidden}
  #deck{position:relative;left:auto;top:auto;width:100vw;height:100svh;transform:none!important;border-radius:0}
  .slide-content{padding:88px 24px 90px;overflow:auto}
  .brand-mini{right:18px;top:18px;width:150px;height:52px}.brand-mini img{width:150px;max-height:52px}
  .h1{font-size:32px}.h2{font-size:28px}.lead{font-size:19px}.body{font-size:16px}
  .two-col,.three-col,.vs-grid,.compass-layout,.agenda-grid,.stats-row{grid-template-columns:1fr;gap:16px}
  .cover .slide-content,.divider .slide-content{width:100%;padding-right:24px}
  .cover h1{font-size:34px}.cover-brand img{width:260px}
  .quote-panel{padding:30px 26px;font-size:20px}
  .mission-band{font-size:20px;padding:18px}
  .stat-big strong{font-size:64px}
  .unit-grid,.batch-grid{grid-template-columns:1fr 1fr}
  .f-core{flex-direction:column;gap:16px}
  .f-core::before{display:none}
  .f-orb{width:140px;height:140px;font-size:16px}
  .f-result{width:160px;height:160px;font-size:20px}
  .compass{display:none}
  .journey{display:flex;flex-direction:column;gap:12px;overflow:auto}
  .j-svg{display:none}
  .j-node,.j-card{position:static;width:auto}
  .j-node{width:52px;height:52px}
  .menu-grid{grid-template-columns:1fr 1fr}
  .path-flow{flex-direction:column}
  .path-flow::before{display:none}
  .path-arrow{transform:rotate(-90deg)}
  .closing-main h2{font-size:28px}
  .aura{display:none}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div id="app">
<div id="deck" aria-live="polite">
<div class="brand-mini" aria-label="جامعة نايف العربية للعلوم الأمنية"><img alt="شعار جامعة نايف العربية للعلوم الأمنية" src="%%LOGO%%"/></div>

<!-- 01 الغلاف -->
<section class="slide cover active" data-title="الغلاف">
<div class="slide-bg" style="background-image:url('%%BG_COVER%%');background-position:85% 52%"></div>
<div class="slide-content">
<div class="cover-brand"><img alt="شعار جامعة نايف العربية للعلوم الأمنية" src="%%LOGO%%"/></div>
<div class="kicker">جامعة نايف العربية للعلوم الأمنية</div>
<h1 class="h1">كيف نقود مستقبل الأمن في ظل التحديات المستقبلية؟</h1>
<p class="subtitle">من بناء القدرات الأمنية إلى تمكين القرار الأمني</p>
<button class="start-btn" id="coverStart" type="button"><strong>ابدأ العرض</strong><span>جولة تفاعلية في مستقبل العمل الأمني</span></button>
</div>
<div class="slide-number">01</div>
</section>

<!-- 02 محاور العرض -->
<section class="slide" data-title="محاور العرض">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV2%%');background-position:center 40%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">محاور العرض</h2><div class="rule"></div></div>
<div class="agenda-grid">
<button class="agenda-card" data-go="2" type="button"><span class="an">المحور 01</span><strong>التحولات والمشهد الأمني العالمي</strong><span>لماذا نحتاج إلى نموذج أمني جديد؟</span><span class="go">انتقل إلى المحور</span></button>
<button class="agenda-card" data-go="6" type="button"><span class="an">المحور 02</span><strong>قدرات المستقبل الأمنية</strong><span>القدرات الست ورحلة القرار الأمني</span><span class="go">انتقل إلى المحور</span></button>
<button class="agenda-card" data-go="10" type="button"><span class="an">المحور 03</span><strong>منظومة الجامعة</strong><span>الموجهات والرؤية ومراكز التميز</span><span class="go">انتقل إلى المحور</span></button>
<button class="agenda-card" data-go="15" type="button"><span class="an">المحور 04</span><strong>البحث العلمي التطبيقي</strong><span>التزييف العميق أنموذجًا</span><span class="go">انتقل إلى المحور</span></button>
<button class="agenda-card" data-go="17" type="button"><span class="an">المحور 05</span><strong>البرامج والاعتماد</strong><span>برامج أكاديمية وتدريبية بمعايير دولية</span><span class="go">انتقل إلى المحور</span></button>
<button class="agenda-card" data-go="23" type="button"><span class="an">المحور 06</span><strong>الشرطة التنبؤية</strong><span>تمكين العمل الشرطي القائم على البيانات</span><span class="go">انتقل إلى المحور</span></button>
</div>
</div>
<div class="slide-number">02</div>
</section>

<!-- 03 التحولات -->
<section class="slide" data-title="التحولات">
<div class="slide-bg kenburns" style="background-image:url('%%PH_QUOTE%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">التحولات</h2><div class="rule"></div></div>
<article class="glass quote-panel"><span class="qmark">”</span>قبل عشر سنوات كانت التهديدات الأمنية تتركز في الإرهاب والجريمة التقليدية... أما اليوم فنواجه الذكاء الاصطناعي، والهجمات السيبرانية، والتضليل الإعلامي، والطائرات المسيّرة، والجرائم الاقتصادية العابرة للحدود...<br/>والسؤال لم يعد: كيف نحمي المجتمع؟ بل كيف نُعِد الجهات الأمنية لهذه البيئة الجديدة؟</article>
<div class="glass mission-band"><span>نبني القدرات...</span><span class="accent">ونمكّن من اتخاذ القرار</span></div>
</div>
<div class="slide-number">03</div>
</section>

<!-- 04 المشهد الأمني العالمي -->
<section class="slide" data-title="المشهد الأمني العالمي">
<div class="slide-bg kenburns" style="background-image:url('%%PH_COVER%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">المشهد الأمني العالمي</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:20px">تشير التقارير الحديثة الصادرة عن الإنتربول، ومكتب الأمم المتحدة المعني بالمخدرات والجريمة، واليوروبول، والمنتدى الاقتصادي العالمي إلى بيئة أمنية سريعة التغير، تتسم بما يلي:</p>
<div class="cards5">
<div class="num-card"><span class="n">01</span><p>تزايد التداخل بين الجريمة المنظمة، والإرهاب، والجرائم المدعومة سيبرانيًا</p></div>
<div class="num-card"><span class="n">02</span><p>تصاعد الهجمات السيبرانية المتقدمة التي توظف الذكاء الاصطناعي والأتمتة ونماذج «الجريمة كخدمة»</p></div>
<div class="num-card"><span class="n">03</span><p>تصاعد الجرائم المالية، بما في ذلك إساءة استخدام العملات الرقمية وغسل الأموال العابر للحدود</p></div>
<div class="num-card"><span class="n">04</span><p>نمو الجرائم البيئية وجرائم الحياة الفطرية نتيجة الضغوط الاقتصادية والمناخية</p></div>
<div class="num-card"><span class="n">05</span><p>تزايد تأثير التضليل الإعلامي والتلاعب الرقمي على استقرار المجتمعات</p></div>
</div>
</div>
<div class="slide-number">04</div>
</section>

<!-- 05 المشهد بالأرقام -->
<section class="slide" data-title="المشهد الأمني العالمي بالأرقام">
<div class="slide-bg kenburns" style="background-image:url('%%PH_CLOSING%%');background-position:center 55%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">المشهد الأمني العالمي بالأرقام</h2><div class="rule"></div></div>
<div class="stats-row">
<div class="glass stat-big"><strong class="count" data-to="60" data-suffix="%">60%</strong><span class="lbl">جريمة رقمية عابرة للحدود</span><p>من شبكات الجريمة المنظمة عالميًا باتت تستخدم أدوات رقمية أو سيبرانية لدعم أنشطتها من تمويل وتواصل وإخفاء وتجنيد، وتعمل ضمن نماذج رقمية عابرة للحدود</p></div>
<div class="glass stat-big"><strong>أعلى 5</strong><span class="lbl">مخاطر عالمية</span><p>صُنّف التهديد السيبراني المعزز بالذكاء الاصطناعي ضمن أعلى خمسة مخاطر عالمية، مع تصاعد نماذج «الجريمة كخدمة» التي خفّضت كلفة الهجوم ورفعت تعقيده</p></div>
<div class="glass stat-big"><strong class="count" data-to="40" data-suffix="%">40%</strong><span class="lbl">تدفقات مالية غير مشروعة</span><p>من التدفقات المالية غير المشروعة باتت تمر عبر منصات رقمية وعملات مشفرة، بينما تحولت الجرائم البيئية إلى أحد مصادر التمويل الرئيسية للجريمة المنظمة وعدم الاستقرار الأمني</p></div>
</div>
</div>
<div class="slide-number">05</div>
</section>

<!-- 06 التحولات الكبرى -->
<section class="slide" data-title="التحولات الكبرى: لماذا نحتاج نموذجًا جديدًا؟">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV1%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">التحولات الكبرى: لماذا نحتاج إلى نموذج جديد؟</h2><div class="rule"></div></div>
<div class="fusion">
<div class="f-row top">
<div class="f-chip"><span class="n">01</span>الذكاء الاصطناعي سيغيّر العمل الأمني</div>
<div class="f-chip"><span class="n">02</span>البيانات أصبحت أهم أداة لمكافحة الجريمة</div>
<div class="f-chip"><span class="n">03</span>الجرائم أصبحت عابرة للحدود</div>
</div>
<div class="f-core">
<div class="f-orb"><div class="ic">%%IC_LAYERS%%</div>القدرات<br/>الأمنية</div>
<span class="f-sym">+</span>
<div class="f-orb o2"><div class="ic">%%IC_COMPASS%%</div>القرار<br/>الأمني</div>
<span class="f-sym s2">=</span>
<div class="f-result">التفوق<br/>الأمني</div>
</div>
<div class="f-caption">بناء القدرات أصبح استثمارًا استراتيجيًا</div>
<div class="f-row bottom">
<div class="f-chip"><span class="n">04</span>الانكشاف الوظيفي بدخول التقنيات كأدوات للجريمة</div>
<div class="f-chip"><span class="n">05</span>القرارات في عدم اليقين</div>
<div class="f-chip"><span class="n">06</span>الأمن لم يعد يُبنى على الموارد فقط</div>
</div>
</div>
</div>
<div class="slide-number">06</div>
</section>

<!-- 07 فاصل الوقاية -->
<section class="slide cover divider" data-title="الوقاية: كيف نبني القدرات؟">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV1%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="kicker">الوقاية</div>
<h1 class="h1">كيف نبني القدرات الأمنية للمستقبل؟</h1>
<p class="subtitle">من ردة الفعل إلى الاستباق... ومن كثرة المعلومات إلى جودة القرار</p>
</div>
<div class="slide-number">07</div>
</section>

<!-- 08 القدرات الست -->
<section class="slide" data-title="قدرات المستقبل الأمنية">
<div class="slide-bg kenburns" style="background-image:url('%%PH_QUOTE%%');background-position:center 35%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">ما هي القدرات الأمنية التي يحتاجها المستقبل؟</h2><div class="rule"></div></div>
<div class="compass-layout">
<div class="compass" aria-label="قدرات المستقبل الأمنية">
<div class="compass-hub">قدرات<br/>المستقبل<br/>الأمنية</div>
<button class="compass-node c1 active" data-cap="0" type="button">الاستشراف<small>من ردة الفعل إلى الاستباق</small></button>
<button class="compass-node c2" data-cap="1" type="button">اتخاذ القرار<small>جودة القرار</small></button>
<button class="compass-node c3" data-cap="2" type="button">الابتكار<small>ابتكار الحلول</small></button>
<button class="compass-node c4" data-cap="3" type="button">التكامل<small>العمل الجماعي</small></button>
<button class="compass-node c5" data-cap="4" type="button">التكيّف<small>المرونة</small></button>
<button class="compass-node c6" data-cap="5" type="button">القيادة<small>من الإدارة إلى القيادة</small></button>
</div>
<article class="glass cap-detail" aria-live="polite">
<div class="cap-index" id="capIndex">القدرة الأولى</div>
<h3 id="capTitle">القدرة على الاستشراف</h3>
<ul id="capPoints"><li>استشراف التهديد</li><li>قراءة الاتجاهات</li></ul>
<div class="cap-shift" id="capShift">من ردة الفعل... إلى الاستباق</div>
<div class="cap-progress" id="capProgress"><span class="active"></span><span></span><span></span><span></span><span></span><span></span></div>
</article>
</div>
</div>
<div class="slide-number">08</div>
</section>
"""

html += r"""
<!-- 09 رحلة القرار -->
<section class="slide" data-title="تمكين القرار الأمني">
<div class="slide-bg kenburns" style="background-image:url('%%PH_CLOSING%%');background-position:center 60%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">تمكين القرار الأمني: رحلة القرار</h2><div class="rule"></div></div>
<div class="path-flow">
<div class="path-step"><span class="sn">01</span><div class="circle">البيانات</div></div>
<span class="path-arrow">←</span>
<div class="path-step"><span class="sn">02</span><div class="circle">المعلومات</div></div>
<span class="path-arrow">←</span>
<div class="path-step"><span class="sn">03</span><div class="circle">التحليل</div></div>
<span class="path-arrow">←</span>
<div class="path-step"><span class="sn">04</span><div class="circle">الذكاء الاصطناعي</div></div>
<span class="path-arrow">←</span>
<div class="path-step"><span class="sn">05</span><div class="circle">الخبرة البشرية</div></div>
<span class="path-arrow">←</span>
<div class="path-step path-final"><span class="sn">06</span><div class="circle">القرار</div></div>
</div>
<div class="glass mission-band" style="margin-top:22px;margin-bottom:64px"><span class="accent">القرار الأفضل</span><span>يصنع الأمن الأفضل</span></div>
</div>
<div class="slide-number">09</div>
</section>

<!-- 10 من المهارات إلى القدرات -->
<section class="slide" data-title="من المهارات إلى القدرات">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV2%%');background-position:center 45%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">من المهارات إلى القدرات</h2><div class="rule"></div></div>
<div class="vs-grid">
<article class="glass vs-card old"><div class="ic">%%IC_GEAR%%</div><h3>المهارات</h3><p>تتحدث معظم الدول والجهات عن المهارات بوصفها هدفًا للتأهيل والتدريب.</p></article>
<div class="vs-mid">←</div>
<article class="glass vs-card new"><div class="ic">%%IC_BARS%%</div><h3>القدرات</h3><p>العالم اليوم انتقل إلى القدرات، والقدرات ليست مجموعة مهارات، بل هي قدرة المؤسسة والفرد على تحقيق نتائج في بيئة معقدة.</p></article>
</div>
<p class="lead" style="text-align:center;margin-top:22px">القدرات الست لتمكين المستقبل الأمني</p>
<div class="chips" style="justify-content:center;margin-top:14px"><span class="chip">الاستشراف</span><span class="chip">اتخاذ القرار</span><span class="chip">الابتكار</span><span class="chip">التكامل</span><span class="chip">التكيّف</span><span class="chip">القيادة</span></div>
</div>
<div class="slide-number">10</div>
</section>

<!-- 11 فاصل الجامعة -->
<section class="slide cover divider" data-title="أين تقف الجامعة؟">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV2%%');background-position:center 45%"></div>
<div class="slide-content">
<div class="kicker">الجامعة اليوم</div>
<h1 class="h1">أين تقف جامعة نايف العربية للعلوم الأمنية؟</h1>
<p class="subtitle">منصة متكاملة لبناء القدرات وتمكين القرار الأمني</p>
</div>
<div class="slide-number">11</div>
</section>

<!-- 12 موجهات الاستراتيجية -->
<section class="slide" data-title="موجهات استراتيجية الجامعة">
<div class="slide-bg kenburns" style="background-image:url('%%PH_COVER%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">منصة متكاملة لبناء القدرات وتمكين القرار الأمني</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:18px">موجهات استراتيجية الجامعة 2025 - 2029</p>
<div data-tabs>
<div class="tabs-bar">
<button class="active" data-tab="0" type="button"><span class="tn">01</span>الوقاية من الجريمة</button>
<button data-tab="1" type="button"><span class="tn">02</span>التقنيات الناشئة والذكاء الاصطناعي</button>
</div>
<div class="tabpane active"><article class="glass panel"><div class="section-label">الوقاية من الجريمة</div><p class="lead">التركيز على الوقاية من الجريمة بدلًا من الاستجابة لها بعد وقوعها يُعد أحد أهم التوجهات الحديثة في مجال العلوم الأمنية. منع الجريمة قبل وقوعها يمثل تحولًا في استراتيجيات الأمن للمساهمة في رفع مستوى جودة الحياة وتحقيق أهداف التنمية المستدامة للأمم المتحدة، من خلال دعم اتخاذ القرار الأمني المبني على البيانات وتوظيف التطورات التقنية لهذا الغرض.</p></article></div>
<div class="tabpane"><article class="glass panel"><div class="section-label">التقنيات الناشئة والذكاء الاصطناعي</div><p class="lead">سيكون للتطورات التقنية تأثير عظيم على شكل الأمن في المستقبل، حيث توفر فرصًا كبيرة للحد من الجريمة، وفي ذات الوقت ستوفر تحديات في حال استغلالها الاستغلال السيئ من قبل العصابات الإجرامية. سنركز على التقنيات الناشئة والذكاء الاصطناعي في كافة أعمالنا من خلال برامجنا الأكاديمية والتدريبية والدراسات والبحوث، وسننشئ مركزًا متخصصًا لهذا الغرض.</p></article></div>
</div>
</div>
<div class="slide-number">12</div>
</section>

<!-- 13 الرؤية والأهداف والممكنات -->
<section class="slide" data-title="الرؤية والأهداف والممكنات">
<div class="slide-bg kenburns" style="background-image:url('%%PH_QUOTE%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">الرؤية والأهداف والممكنات 2025 - 2029</h2><div class="rule"></div></div>
<div class="three-col">
<div class="glass feature-card"><div class="ic">%%IC_EYE%%</div><h3>الرؤية</h3><p>منصة متكاملة لبناء القدرات وتمكين القرار الأمني</p></div>
<div class="glass feature-card"><div class="ic">%%IC_TARGET%%</div><h3>الأهداف</h3><p>موجهان استراتيجيان: الوقاية من الجريمة قبل وقوعها، وتوظيف التقنيات الناشئة والذكاء الاصطناعي في كافة الأعمال</p></div>
<div class="glass feature-card"><div class="ic">%%IC_LAYERS%%</div><h3>الممكنات</h3><p>مراكز تميز متخصصة، وبرامج أكاديمية وتدريبية مستحدثة، واعتمادات محلية ودولية</p></div>
</div>
</div>
<div class="slide-number">13</div>
</section>

<!-- 14 مراكز التميز -->
<section class="slide" data-title="مراكز التميز">
<div class="slide-bg kenburns" style="background-image:url('%%PH_CLOSING%%');background-position:center 55%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">مراكز التميز</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:16px">توجهت الجامعة لإنشاء مراكز تميّز تغطي الأولويات الأمنية، منها مركزان بالشراكة مع مكتب الأمم المتحدة المعني بالمخدرات والجريمة والمنظمة الدولية للهجرة</p>
<div data-tabs style="display:flex;flex-direction:column;flex:1;min-height:0">
<div class="tabs-bar">
<button class="active" data-tab="0" type="button">الذكاء الاصطناعي</button>
<button data-tab="1" type="button">الجرائم السيبرانية والاقتصادية</button>
<button data-tab="2" type="button">مكافحة المخدرات والجريمة</button>
<button data-tab="3" type="button">السلامة المرورية</button>
<button data-tab="4" type="button">إدارة الهجرة والحدود</button>
<button data-tab="5" type="button">البحوث الأمنية</button>
</div>
<div class="tabpane active"><div class="cen-pane"><figure class="cen-img"><img alt="مركز الذكاء الاصطناعي" src="%%CEN1%%"/></figure><article class="glass panel"><div class="section-label">مركز الذكاء الاصطناعي الأمني</div><p class="body">إحدى مبادرات الخطة الاستراتيجية، أُنشئ لدعم وتشكيل مستقبل العمل الأمني في المنطقة والعالم، ويُعد أحدث المراكز البحثية في الجامعة تلبيةً للتطورات التقنية المتسارعة في هذا المجال.</p><div class="chips"><span class="chip">علوم البيانات وتعلم الآلة</span><span class="chip">الروبوتات والأنظمة الذاتية</span><span class="chip">الرؤية الحاسوبية</span></div></article></div></div>
<div class="tabpane"><div class="cen-pane"><figure class="cen-img"><img alt="مركز الجرائم السيبرانية والاقتصادية" src="%%CEN2%%"/></figure><article class="glass panel"><div class="section-label">مركز الجرائم السيبرانية والاقتصادية</div><p class="body">يركز على استخدامات التقنية في المجالات الأمنية والتقنيات الناشئة والجرائم الاقتصادية، لتمكين الجهات المستفيدة في الدول العربية من التعامل مع تحديات التقنيات الحديثة على المستوى الإقليمي والدولي.</p><div class="chips"><span class="chip">الجرائم السيبرانية</span><span class="chip">الأدلة الرقمية</span><span class="chip">الجرائم الاقتصادية</span><span class="chip">الجرائم العابرة للحدود</span></div></article></div></div>
<div class="tabpane"><div class="cen-pane"><figure class="cen-img"><img alt="مركز الخبرة الإقليمي لمكافحة المخدرات والجريمة" src="%%CEN3%%"/></figure><article class="glass panel"><div class="section-label">مركز الخبرة الإقليمي لمكافحة المخدرات والجريمة</div><p class="body">تأسس بالشراكة مع مكتب الأمم المتحدة المعني بالمخدرات والجريمة، ويتخصص في مجالين رئيسيين هما المخدرات والجريمة بشكل عام، ويندرج تحت كل مجال عدد من القضايا ذات الأولوية التي تنعكس فيما ينفذه المركز من دراسات وتقارير سياسات وبرامج أكاديمية ودورات تدريبية وأنشطة علمية.</p><div class="chips"><span class="chip">الاتجار غير المشروع بالمخدرات</span><span class="chip">الجرائم المنظمة</span><span class="chip">العدالة الجنائية</span></div></article></div></div>
<div class="tabpane"><div class="cen-pane"><figure class="cen-img"><img alt="مركز السلامة المرورية على الطرق" src="%%CEN4%%"/></figure><article class="glass panel"><div class="section-label">مركز السلامة المرورية على الطرق</div><p class="body">مركز متخصص يسعى إلى تطوير وتنفيذ برامج شاملة للتأهيل وتطوير القدرات في كافة مجالات السلامة المرورية في الدول العربية، بهدف تأهيل العاملين في مجال العمل المروري لاتخاذ التدابير الوقائية للحد من حوادث المرور والإصابات والوفيات.</p><div class="chips"><span class="chip">الهندسة المرورية</span><span class="chip">إدارة الحوادث المرورية</span><span class="chip">التقنيات المرورية الحديثة</span></div></article></div></div>
<div class="tabpane"><div class="cen-pane"><figure class="cen-img"><img alt="المركز العربي للتعاون الفني في إدارة الهجرة والحدود" src="%%CEN5%%"/></figure><article class="glass panel"><div class="section-label">المركز العربي للتعاون الفني في إدارة الهجرة والحدود</div><p class="body">تأسس بالشراكة مع المنظمة الدولية للهجرة، ويتطلع إلى توفير التوجيه والإرشاد لصانع القرار العربي في مجال إدارة الهجرة والحدود على نحو أكثر كفاءة عربيًا ودوليًا، ودعم مستوى الوعي بقضايا الهجرة وإدارة أمن الحدود وفق أفضل الممارسات الدولية.</p><div class="chips"><span class="chip">الهجرة غير النظامية</span><span class="chip">إدارة الحدود</span></div></article></div></div>
<div class="tabpane"><div class="cen-pane"><figure class="cen-img"><img alt="مركز البحوث الأمنية" src="%%CEN6%%"/></figure><article class="glass panel"><div class="section-label">مركز البحوث الأمنية</div><p class="body">مركز متخصص في تحليل القضايا الأمنية ودراسة تأثيرها على الأمن الوطني للدول العربية، يعمل على تقديم فهم شامل للقضايا والتحديات الأمنية الناشئة وتطوير حلول استباقية لها. تأسس قبل أكثر من أربعين عامًا لدعم صناعة القرار الأمني في الدول العربية من خلال إعداد الخبراء في مجال الأمن الوطني.</p><div class="chips"><span class="chip">الأمن الداخلي</span><span class="chip">الأمن البيئي</span><span class="chip">التهديدات المستقبلية</span></div></article></div></div>
</div>
</div>
<div class="slide-number">14</div>
</section>

<!-- 15 كليات الجامعة -->
<section class="slide" data-title="كليات الجامعة">
<div class="slide-bg kenburns" style="background-image:url('%%PH_STUDENTS%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">كليات الجامعة</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:16px">برامج الدكتوراه والماجستير والدبلوم العالي في كليتي الجامعة</p>
<div data-tabs style="display:flex;flex-direction:column;flex:1;min-height:0">
<div class="tabs-bar">
<button class="active" data-tab="0" type="button">كلية العدالة الجنائية وعلوم الجريمة</button>
<button data-tab="1" type="button">كلية علوم الأدلة والتحقيقات الجنائية</button>
</div>
<div class="tabpane active"><article class="glass panel"><div class="prog-list two">
<div class="prog"><strong>دكتوراه القانون الجنائي</strong><span class="pdept">قسم القانون</span></div>
<div class="prog"><strong>برنامج ماجستير الجرائم الاقتصادية</strong><span class="pdept">قسم القانون</span></div>
<div class="prog"><strong>ماجستير الأمن الوطني</strong><span class="pdept">قسم الأمن الوطني</span></div>
<div class="prog"><strong>ماجستير الآداب في القانون الجنائي والعلوم الجنائية</strong><span class="pdept">قسم القانون</span></div>
<div class="prog"><strong>ماجستير إنفاذ القانون</strong><span class="pdept">قسم القانون</span></div>
<div class="prog"><strong>ماجستير الآداب في علم الجريمة</strong><span class="pdept">قسم علوم الجريمة</span></div>
<div class="prog"><strong>الدبلوم العالي في حوكمة وأمن الحدود</strong><span class="pdept">قسم الأمن الوطني</span></div>
<div class="prog"><strong>الدبلوم العالي في مكافحة الإرهاب</strong></div>
<div class="prog"><strong>الدبلوم العالي في استراتيجيات مكافحة المخدرات</strong><span class="pdept">قسم علوم الجريمة</span></div>
<div class="prog"><strong>الدبلوم العالي في حقوق الإنسان والعدالة الجنائية</strong><span class="pdept">قسم القانون</span></div>
<div class="prog"><strong>الدبلوم العالي في الأمن الوطني</strong><span class="pdept">قسم الأمن الوطني</span></div>
</div></article></div>
<div class="tabpane"><article class="glass panel"><div class="prog-list">
<div class="prog"><strong>ماجستير الذكاء الاصطناعي الأمني</strong><span class="pdept">قسم الأمن السيبراني والأدلة الرقمية</span></div>
<div class="prog"><strong>ماجستير العلوم في الجرائم السيبرانية والتحقيق الجنائي الرقمي</strong><span class="pdept">قسم الأمن السيبراني والأدلة الرقمية</span></div>
<div class="prog"><strong>برنامج ماجستير العلوم في الأدلة الجنائية</strong><span class="pdept">قسم الأدلة الجنائية</span></div>
<div class="prog"><strong>الدبلوم العالي في الجرائم السيبرانية والتحقيق الجنائي الرقمي</strong><span class="pdept">قسم الأمن السيبراني والأدلة الرقمية</span></div>
</div></article></div>
</div>
</div>
<div class="slide-number">15</div>
</section>

<!-- 16 التزييف العميق -->
<section class="slide" data-title="البحث العلمي التطبيقي: التزييف العميق أنموذجًا">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV1%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">البحث العلمي التطبيقي: التزييف العميق أنموذجًا</h2><div class="rule"></div></div>
<div class="journey">
<svg class="j-svg" viewBox="0 0 1430 460" preserveAspectRatio="none" aria-hidden="true">
<defs><marker id="jArr" markerWidth="10" markerHeight="10" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="rgba(199,176,140,.85)"/></marker></defs>
<path d="M1356 411 L1119 337 L880 263 L641 190 L404 116 L150 43" marker-end="url(#jArr)"/>
</svg>
<div class="j-node j-st1">2022</div>
<div class="j-card j-c1" data-year="2022"><strong>تحديد المشكلة</strong><p><span class="j-hl">ورشة عمل مكافحة التزييف العميق</span> لتعزيز الأمن المستقبلي</p><span class="j-stat">42 خبيرًا · 24 دولة</span></div>
<div class="j-node j-st2">2023</div>
<div class="j-card j-c2" data-year="2023"><strong>توليد الأفكار</strong><p>إيفاد طالب إلى روسيا وجمع البيانات</p><span class="j-stat">3 أشهر</span></div>
<div class="j-node j-st3">2024</div>
<div class="j-card j-c3" data-year="2024"><strong>إثبات المفهوم</strong><p>النشر في <span class="j-hl">دار سبرينغر العلمية</span> وتقنيات تحديد مواقع التزييف</p><span class="j-stat">مجلة مصنفة Q1</span></div>
<div class="j-node j-st4">2025</div>
<div class="j-card j-c4" data-year="2025"><strong>الإصدار الأول</strong><p>استخدام النظام في الجهات الحكومية وإطلاقه خلال <span class="j-hl">الملتقى الثاني لاستخدامات الذكاء الاصطناعي في المجالات الأمنية</span></p></div>
<div class="j-node j-st5">2026</div>
<div class="j-card j-c5" data-year="2026"><strong>الإصدار الثاني</strong><p>قيد التنفيذ: كشف تزييف الوسائط المتعددة (الصوت والفيديو) بالتعديل البؤري</p><span class="j-stat">INTERPOL · UNICRI</span></div>
<div class="j-node fut j-st6">المستقبل</div>
<div class="j-card fut j-c6" data-year="المستقبل"><strong>النموذج العربي</strong><p>نموذج ذكاء اصطناعي متقدم مدرب على بيانات الجرائم المرتبطة بالتزييف العميق <span class="j-hl">باللغة العربية</span></p></div>
</div>
<div class="glass achieve-band"><strong class="count" data-to="43" data-suffix="+%">+43%</strong><p>الإنجاز الرئيسي: تطبيق ميداني للنظام وتطوير نموذج ذكاء اصطناعي جديد حقق تحسنًا بنسبة 43% على البيانات غير المرئية سابقًا — مع نشر ورقتين بحثيتين وورقتين أخريين قيد التحضير</p></div>
</div>
<div class="slide-number">15</div>
</section>

<!-- 17 مركز الذكاء الاصطناعي: الرؤية والرسالة والأهداف -->
<section class="slide" data-title="مركز الذكاء الاصطناعي: الرؤية والرسالة والأهداف">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV1%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">مركز الذكاء الاصطناعي الأمني: الرؤية والرسالة والأهداف</h2><div class="rule"></div></div>
<div class="three-col">
<div class="glass feature-card"><div class="ic">%%IC_EYE%%</div><h3>الرؤية</h3><p>أن نكون المركز الرائد في الذكاء الاصطناعي الأمني لدعم العمل الشرطي المستقبلي في المنطقة العربية</p></div>
<div class="glass feature-card"><div class="ic">%%IC_COMPASS%%</div><h3>الرسالة</h3><p>مساعدة الأجهزة الأمنية في تبني تقنيات الذكاء الاصطناعي لمواجهة التحديات الأمنية من خلال إجراء أبحاث متقدمة وتقديم حلول قائمة على البيانات للمساعدة في الوقاية من الجريمة واكتشافها</p></div>
<div class="glass feature-card"><div class="ic">%%IC_TARGET%%</div><h3>الأهداف</h3><p>تنمية القدرات البشرية، ودعم عملية اتخاذ القرار، وإجراء الأبحاث وتقديم حلول ابتكارية</p></div>
</div>
</div>
<div class="slide-number">17</div>
</section>

<!-- 16 فاصل البرامج -->
<section class="slide cover divider" data-title="نماذج من البرامج المستحدثة">
<div class="slide-bg kenburns" style="background-image:url('%%PH_STUDENTS%%');background-position:center 40%"></div>
<div class="slide-content">
<div class="kicker">بناء القدرات</div>
<h1 class="h1">نماذج من البرامج المستحدثة</h1>
<p class="subtitle">برامج أكاديمية وتدريبية تواكب التحولات الأمنية والتقنية</p>
</div>
<div class="slide-number">16</div>
</section>

<!-- 17 البرامج الأكاديمية -->
<section class="slide" data-title="البرامج الأكاديمية: ماجستير الذكاء الاصطناعي الأمني">
<div class="slide-bg kenburns" style="background-image:url('%%PH_STUDENTS%%');background-position:center 45%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">البرامج الأكاديمية: ماجستير العلوم في الذكاء الاصطناعي الأمني</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:16px">أول برنامج ماجستير من نوعه في المنطقة — انطلق في أغسطس 2024</p>
<div data-tabs style="display:flex;flex-direction:column;flex:1;min-height:0">
<div class="tabs-bar">
<button class="active" data-tab="0" type="button">الفصل الأول</button>
<button data-tab="1" type="button">الفصل الثاني</button>
<button data-tab="2" type="button">الفصل الثالث</button>
<button data-tab="3" type="button">الفصل الرابع</button>
<button data-tab="4" type="button">نواتج التعلم</button>
</div>
<div class="tabpane active"><article class="glass panel"><div class="course-list">
<div class="course"><strong>مقدمة في الذكاء الاصطناعي والبرمجة</strong><span class="en">Introduction to Artificial Intelligence &amp; Programming</span></div>
<div class="course"><strong>علوم البيانات لإنفاذ القانون</strong><span class="en">Data Science for Law Enforcement</span></div>
<div class="course"><strong>القانون والأخلاقيات في التقنية</strong><span class="en">Law &amp; Ethics in Technology</span></div>
</div></article></div>
<div class="tabpane"><article class="glass panel"><div class="course-list">
<div class="course"><strong>تحليل الشبكات الاجتماعية والتنقيب في الرسوم البيانية</strong><span class="en">Social Network Analysis and Graph Mining</span></div>
<div class="course"><strong>مناهج البحث</strong><span class="en">Research Methodologies</span></div>
<div class="course"><strong>مواضيع متقدمة في الذكاء الاصطناعي للوقاية من الجريمة</strong><span class="en">Advanced Topics in AI for Crime Prevention</span></div>
</div></article></div>
<div class="tabpane"><article class="glass panel"><div class="course-list">
<div class="course"><strong>الرؤية الحاسوبية ومعالجة الصور</strong><span class="en">Computer Vision &amp; Image Processing</span></div>
<div class="course"><strong>جرائم مدعومة بالذكاء الاصطناعي</strong><span class="en">AI-enabled Crimes</span></div>
<div class="course"><strong>الوقاية من الجريمة باستخدام الذكاء الاصطناعي</strong><span class="en">AI-based Crime Prevention</span></div>
</div></article></div>
<div class="tabpane"><article class="glass panel"><div class="course-list">
<div class="course"><strong>مشروع التخرج / الأطروحة</strong><span class="en">Graduation Project / Thesis</span></div>
</div></article></div>
<div class="tabpane"><article class="glass panel"><div class="section-label">نواتج التعلم المتوقعة من البرنامج</div><div class="lo-list">
<div class="lo"><strong>تطبيق المعايير الأخلاقية والمهنية العالية من خلال الاستخدام المسؤول للذكاء الاصطناعي والتقنيات ذات الصلة.</strong></div>
<div class="lo"><strong>فهم الآثار القانونية والأخلاقية لاستخدام الذكاء الاصطناعي في إنفاذ القانون، بما في ذلك المخاوف المتعلقة بالخصوصية، وقضايا التحيز والعدالة، والشفافية، والمساءلة، والالتزام بالأطر التنظيمية وحقوق الإنسان.</strong></div>
<div class="lo"><strong>تطوير التطبيقات القائمة على الذكاء الاصطناعي لدعم الأجهزة الشرطية ومنع الجريمة استباقيًا.</strong></div>
<div class="lo"><strong>تقييم وإدارة المخاطر المرتبطة بتطبيقات الذكاء الاصطناعي في مجال الأمن، بما في ذلك تحديد نقاط الضعف المحتملة، وإجراء تقييمات التهديدات، وتنفيذ استراتيجيات تخفيف أثر المخاطر.</strong></div>
<div class="lo"><strong>التعرف على الهجمات العدائية على أنظمة الذكاء الاصطناعي، واستكشاف آليات وتقنيات الدفاع لتعزيز أمان وقوة نماذج الذكاء الاصطناعي.</strong></div>
<div class="lo"><strong>استكشاف أحدث التطبيقات العملية للذكاء الاصطناعي في مجال الأمن وإنفاذ القانون، واكتساب مهارات جمع وتخزين ومعالجة وتحليل البيانات الأمنية الضخمة من مصادر مختلفة، لاستخلاص رؤى قابلة للتنفيذ وتدعم اتخاذ القرار.</strong></div>
<div class="lo"><strong>تطوير أساس قوي في الذكاء الاصطناعي للجهات الأمنية وإنفاذ القانون، بما في ذلك التعلم الآلي، والتعلم العميق، ومعالجة اللغات الطبيعية، ورؤية الحاسوب، وتقنيات الذكاء الاصطناعي الأخرى ذات الصلة.</strong></div>
</div></article></div>
</div>
</div>
<div class="slide-number">17</div>
</section>

<!-- 18 البرامج التدريبية -->
<section class="slide" data-title="البرامج التدريبية: محقق جرائم سيبرانية">
<div class="slide-bg kenburns" style="background-image:url('%%PH_COVER%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">البرامج التدريبية: برنامج محقق جرائم سيبرانية أنموذجًا</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:16px">برنامج تدريبي قائم على المهام الوظيفية</p>
<div class="unit-grid">
<div class="unit-card"><span class="un">الوحدة 01</span><strong>الجرائم السيبرانية والأمن السيبراني الهجومي</strong><span class="en">Cybercrime and Offensive Cyber Security</span><span class="dur">5 أيام</span></div>
<div class="unit-card"><span class="un">الوحدة 02</span><strong>حيازة الأدلة الرقمية</strong><span class="en">Digital Evidence Seizure</span><span class="dur">5 أيام</span></div>
<div class="unit-card"><span class="un">الوحدة 03</span><strong>التحقيق الرقمي للحواسيب</strong><span class="en">Computer Forensics</span><span class="dur">5 أيام</span></div>
<div class="unit-card"><span class="un">الوحدة 04</span><strong>التحقيق الجنائي في الشبكات</strong><span class="en">Network Forensics</span><span class="dur">5 أيام</span></div>
<div class="unit-card"><span class="un">الوحدة 05</span><strong>التحقيق الجنائي في الهواتف</strong><span class="en">Mobile Forensics</span><span class="dur">5 أيام</span></div>
<div class="unit-card"><span class="un">الوحدة 06</span><strong>تطبيق عملي على قضية سيبرانية</strong><span class="en">Case Practice</span><span class="dur">3 أيام</span></div>
</div>
</div>
<div class="slide-number">18</div>
</section>

<!-- 19 برنامج دولي -->
<section class="slide" data-title="برنامج دولي: سبع دفعات">
<div class="slide-bg kenburns" style="background-image:url('%%PH_QUOTE%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">البرنامج التدريبي للتحقيق في الجرائم السيبرانية... أصبح برنامجًا دوليًا</h2><div class="rule"></div></div>
<div class="batch-grid">
<div class="batch-card"><span class="bn">الدفعة الأولى</span><strong>مايو - يونيو</strong><span>2022</span><div class="bchips"><span class="bchip">السعودية</span></div></div>
<div class="batch-card"><span class="bn">الدفعة الثانية</span><strong>سبتمبر - نوفمبر</strong><span>2022</span><div class="bchips"><span class="bchip">السعودية</span><span class="bchip">إسبانيا</span><span class="bchip">كوريا الجنوبية</span><span class="bchip">الأوروغواي</span></div></div>
<div class="batch-card"><span class="bn">الدفعة الثالثة</span><strong>مايو - يونيو</strong><span>2023</span><div class="bchips"><span class="bchip">السعودية</span><span class="bchip">هونغ كونغ</span></div></div>
<div class="batch-card"><span class="bn">الدفعة الرابعة</span><strong>سبتمبر - أكتوبر</strong><span>2023</span><div class="bchips"><span class="bchip">السعودية</span><span class="bchip">هونغ كونغ</span><span class="bchip">رومانيا</span></div></div>
<div class="batch-card"><span class="bn">الدفعة الخامسة</span><strong>أبريل - مايو</strong><span>2024</span><div class="bchips"><span class="bchip">السعودية</span></div></div>
<div class="batch-card"><span class="bn">الدفعة السادسة</span><strong>أغسطس - سبتمبر</strong><span>2024</span><div class="bchips"><span class="bchip">السعودية</span><span class="bchip">إسبانيا</span></div></div>
<div class="batch-card"><span class="bn">الدفعة السابعة</span><strong>أكتوبر - ديسمبر</strong><span>2025</span><div class="bchips"><span class="bchip">السعودية</span><span class="bchip">البحرين</span></div></div>
<div class="batch-card" style="border-color:rgba(199,176,140,.55);background:rgba(42,99,100,.3)"><span class="bn">مسار مستمر</span><strong>برنامج دولي</strong><span>بمشاركة دولية متنامية</span></div>
</div>
</div>
<div class="slide-number">19</div>
</section>

<!-- 20 المؤتمرات الدولية -->
<section class="slide" data-title="المؤتمرات الدولية: مؤتمر الإنتربول">
<div class="slide-bg kenburns" style="background-image:url('%%PH_CLOSING%%');background-position:center 55%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">المؤتمرات الدولية: استضافة المؤتمر الثاني للإنتربول حول المستقبل الشرطي أنموذجًا</h2><div class="rule"></div></div>
<p class="lead" style="margin-bottom:18px">مؤتمر الإنتربول لمستقبل العمل الشرطي 2025 — 18 أغسطس 2025</p>
<div class="three-col">
<div class="glass feature-card"><div class="ic">%%IC_CITY%%</div><h3>الشرطة في المدن المستقبلية</h3><p>فهم تطور الجريمة في المدن المستقبلية، وكيف يمكن لإنفاذ القانون البقاء متقدمًا — الشرطة والذكاء الاصطناعي</p></div>
<div class="glass feature-card"><div class="ic">%%IC_GLOBE%%</div><h3>إطار الكفاءات العالمي</h3><p>المشاركة في وضع إطار كفاءات عالمي يحدد المهارات المطلوبة لإنفاذ القانون الجاهز للمستقبل</p></div>
<div class="glass feature-card"><div class="ic">%%IC_COMPASS%%</div><h3>القيادة الرؤيوية للأمن العالمي</h3><p>المشاركة في تصميم نموذج قيادي يحدد القيم والإجراءات المطلوبة للقائد الجاهز للمستقبل</p></div>
</div>
</div>
<div class="slide-number">20</div>
</section>

<!-- 21 الاعتماد -->
<section class="slide" data-title="الاعتماد والاعتراف والتصنيف">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV2%%');background-position:center 45%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">الاعتماد والاعتراف والتصنيف كنتيجة لجودة المخرجات التعليمية والتدريبية</h2><div class="rule"></div></div>
<div data-tabs style="display:flex;flex-direction:column;flex:1;min-height:0">
<div class="tabs-bar">
<button class="active" data-tab="0" type="button">الاعتمادات</button>
<button data-tab="1" type="button">الاعتراف</button>
<button data-tab="2" type="button">شركاء النجاح</button>
</div>
<div class="tabpane active"><div class="logo-grid">
<div class="glass logo-card"><img alt="الجمعية الأمريكية للأمن الصناعي" src="%%LOGO_ASIS%%"/></div>
<div class="glass logo-card"><img alt="الإنتربول" src="%%LOGO_INTERPOL%%"/></div>
<div class="glass logo-card"><img alt="مجلس اعتماد التعليم والتدريب المستمر" src="%%LOGO_ACCET%%"/></div>
<div class="glass logo-card"><img alt="اعتماد البرامج التدريبية" src="%%LOGO_ACCREDITED%%"/></div>
</div></div>
<div class="tabpane"><article class="glass panel logo-pane"><img alt="جهات الاعتراف والتصنيف" src="%%ACCRED%%"/></article></div>
<div class="tabpane"><article class="glass panel logo-pane"><img alt="شركاء النجاح" src="%%PARTNERS%%"/></article></div>
</div>
</div>
<div class="slide-number">21</div>
</section>

<!-- 22 الشرطة التنبؤية: الهدف العام -->
<section class="slide" data-title="الشرطة التنبؤية: الهدف العام">
<div class="slide-bg kenburns" style="background-image:url('%%PH_DIV1%%');background-position:center 50%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">برنامج الشرطة التنبؤية: الهدف العام</h2><div class="rule"></div></div>
<article class="glass quote-panel" style="font-size:27px"><span class="qmark">”</span>بناء وتمكين القدرات المتقدمة لدى المحللين الجنائيين وضباط الشرطة والاستخبارات والوحدات التقنية، وتزويدهم بالمعارف والمهارات التحليلية والحاسوبية والتطبيقية اللازمة لتوظيف البيانات والتقنيات الحديثة في دعم العمل الشرطي القائم على الأدلة، وتمكين المتدربين من تصميم وتطبيق وتقييم حلول الشرطة التنبؤية بكفاءة ومسؤولية، بما يدعم فعالية الأجهزة الأمنية مع مراعاة مبادئ العدالة والنزاهة والمواءمة مع المتطلبات العملية الميدانية.</article>
</div>
<div class="slide-number">22</div>
</section>

<!-- 23 الشرطة التنبؤية: المساران -->
<section class="slide" data-title="الشرطة التنبؤية: مسارا البرنامج">
<div class="slide-bg kenburns" style="background-image:url('%%PH_COVER%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">برنامج الشرطة التنبؤية: مسارا البرنامج</h2><div class="rule"></div></div>
<div data-tabs style="display:flex;flex-direction:column;flex:1;min-height:0">
<div class="tabs-bar">
<button class="active" data-tab="0" type="button"><span class="tn">المسار الأول</span>التقني</button>
<button data-tab="1" type="button"><span class="tn">المسار الثاني</span>التنفيذي لغير التقنيين</button>
</div>
<div class="tabpane active"><article class="glass panel"><p class="lead">برنامج تدريبي متقدم يمتد لخمسة أسابيع، يهدف إلى تمكين الكوادر الأمنية والتحليلية من تقنيات إنفاذ القانون القائمة على البيانات. يرتكز على المعايير الدولية في مجالات هندسة البيانات، وتعلم الآلة، والاستخبارات الجيومكانية، متدرجًا من الأساسيات النظرية إلى التطبيق التشغيلي، ويُختتم بمشروع عملي يضمن قدرة المشاركين على تصميم ونشر حلول تنبؤية دقيقة وعادلة للتحديات الأمنية الواقعية.</p></article></div>
<div class="tabpane"><article class="glass panel"><p class="lead">برنامج قيادي استراتيجي يمتد لخمسة أسابيع، مخصص لتمكين صناع القرار والقيادات الأمنية من حوكمة وتوجيه العمل الشرطي القائم على البيانات. يركز على الأبعاد الأخلاقية، والامتثال القانوني، وإدارة المخاطر، ليعزز القدرة على التفسير النقدي للمخرجات التحليلية، ويُختتم بمشروع تنفيذي لتصميم خطة استراتيجية لتبني تقنيات التنبؤ بما يخدم الأهداف المؤسسية ويعزز ثقة المجتمع.</p></article></div>
</div>
</div>
<div class="slide-number">23</div>
</section>

<!-- 24 الرسالة الختامية -->
<section class="slide" data-title="الرسالة الختامية">
<div class="slide-bg kenburns" style="background-image:url('%%PH_QUOTE%%');background-position:center 30%"></div>
<div class="slide-content">
<div class="title-row"><h2 class="h2">الرسالة الختامية</h2><div class="rule"></div></div>
<article class="glass quote-panel"><span class="qmark">”</span>نؤمن بأننا شركاء في تشكيل مستقبل الأمن في المنطقة، عبر إعداد كوادر أمنية متمكنة، متطورة، وجاهزة لمواكبة التحديات بأساليب استباقية ومهنية رفيعة.</article>
<div class="glass mission-band"><span>معكم...</span><span class="accent">نبني اليوم كفاءات، ونصنع غدًا أكثر أمنًا</span></div>
</div>
<div class="slide-number">24</div>
</section>

<!-- 25 شكرًا -->
<section class="slide cover closing-cover" data-title="شكرًا لكم">
<div class="slide-bg kenburns" style="background-image:url('%%PH_CLOSING%%');background-position:center 60%"></div>
<div class="slide-content">
<div class="closing-top"><div class="cover-brand"><img alt="شعار جامعة نايف العربية للعلوم الأمنية" src="%%LOGO%%"/></div></div>
<div class="closing-main">
<div class="closing-kicker">كيف نقود مستقبل الأمن في ظل التحديات المستقبلية؟</div>
<h2>شكرًا لكم</h2>
<p>جامعة نايف العربية للعلوم الأمنية</p>
<div class="closing-actions">
<button id="restartBtn" type="button">العودة إلى البداية</button>
<button id="closingMenuBtn" type="button">فهرس العرض</button>
</div>
</div>
<div class="closing-footer"><div>نبني القدرات... ونمكّن من اتخاذ القرار</div><div>2025</div></div>
</div>
<div class="slide-number">25</div>
</section>

<div id="controls" aria-label="أدوات العرض">
<button aria-label="الشريحة التالية" class="ctrl" id="nextBtn">‹</button>
<div id="counter">01 / 25</div>
<button aria-label="الشريحة السابقة" class="ctrl" id="prevBtn">›</button>
<button aria-label="فهرس الشرائح" class="ctrl" id="menuBtn">☰</button>
<button aria-label="ملء الشاشة" class="ctrl" id="fullBtn">⛶</button>
</div>
<div id="progress"></div>
<div id="toast"></div>
<div id="menu" aria-hidden="true">
<div class="menu-head"><h2>فهرس الشرائح</h2><button class="menu-close" id="menuClose">إغلاق</button></div>
<div class="menu-grid" id="menuGrid"></div>
</div>
<div id="jzoom" aria-hidden="true">
<div class="jzoom-card">
<div class="jzoom-year"></div>
<div class="jzoom-body"></div>
</div>
</div>
</div>
</div>
<script>
(function(){
'use strict';
var deck=document.getElementById('deck');
var slides=[].slice.call(document.querySelectorAll('.slide'));
var counter=document.getElementById('counter');
var progress=document.getElementById('progress');
var menu=document.getElementById('menu');
var menuGrid=document.getElementById('menuGrid');
var toast=document.getElementById('toast');
var index=0,touchX=0,touchY=0;
function fit(){
  if(window.matchMedia('(max-width:900px) and (orientation:portrait)').matches){deck.style.transform='none';return;}
  var s=Math.min(window.innerWidth/1600,window.innerHeight/900);
  deck.style.transform='translate(-50%,-50%) scale('+s+')';
}
function showToast(t){toast.textContent=t;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(function(){toast.classList.remove('show')},1400)}
function animateCounts(slide){
  slide.querySelectorAll('.count').forEach(function(el){
    var to=parseFloat(el.dataset.to),suf=el.dataset.suffix||'',t0=null;
    function step(ts){if(!t0)t0=ts;var p=Math.min(1,(ts-t0)/1200);el.textContent=Math.round(to*p)+suf;if(p<1)requestAnimationFrame(step)}
    requestAnimationFrame(step);
  });
}
function go(to,dir){
  to=Math.max(0,Math.min(slides.length-1,to));
  if(to===index)return;
  slides[index].classList.remove('active');
  slides.forEach(function(s,i){s.classList.toggle('prev',i<to);s.setAttribute('aria-hidden',i===to?'false':'true')});
  index=to;
  slides[index].classList.add('active');animateCounts(slides[index]);
  counter.textContent=String(index+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
  progress.style.width=((index+1)/slides.length*100)+'%';
  [].forEach.call(menuGrid.children,function(b,i){b.classList.toggle('active',i===index)});
  try{history.replaceState(null,'','#slide-'+(index+1))}catch(e){}
}
function tabStep(dir){
  var box=slides[index].querySelector('[data-tabs]');
  if(!box)return false;
  var btns=[].slice.call(box.querySelectorAll('.tabs-bar button'));
  var cur=btns.findIndex(function(b){return b.classList.contains('active')});
  var nxt=cur+dir;
  if(nxt<0||nxt>=btns.length)return false;
  btns[nxt].click();
  return true;
}
function next(){if(tabStep(1))return;if(index<slides.length-1)go(index+1,1)}
function prev(){if(tabStep(-1))return;if(index>0)go(index-1,-1)}
document.getElementById('nextBtn').addEventListener('click',next);
document.getElementById('prevBtn').addEventListener('click',prev);
slides.forEach(function(s,i){
  var b=document.createElement('button');b.className='menu-item'+(i===0?' active':'');
  b.innerHTML='<div class="mn">'+String(i+1).padStart(2,'0')+'</div><div class="mt">'+s.dataset.title+'</div>';
  b.addEventListener('click',function(){menu.classList.remove('open');go(i,i>index?1:-1)});
  menuGrid.appendChild(b);
});
function openMenu(){menu.classList.add('open');menu.setAttribute('aria-hidden','false')}
function closeMenu(){menu.classList.remove('open');menu.setAttribute('aria-hidden','true')}
document.getElementById('menuBtn').addEventListener('click',openMenu);
document.getElementById('menuClose').addEventListener('click',closeMenu);
document.getElementById('fullBtn').addEventListener('click',function(){
  try{
    if(!document.fullscreenElement){document.documentElement.requestFullscreen();showToast('وضع ملء الشاشة')}
    else{document.exitFullscreen()}
  }catch(e){}
});
document.getElementById('restartBtn').addEventListener('click',function(){go(0,-1)});
document.getElementById('closingMenuBtn').addEventListener('click',openMenu);
document.getElementById('coverStart').addEventListener('click',next);
document.querySelectorAll('[data-go]').forEach(function(b){
  b.addEventListener('click',function(){go(Number(b.dataset.go),1)});
});
document.addEventListener('keydown',function(e){
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.target.matches('button')&&(e.key==='Enter'||e.key===' '))return;
  if(e.key==='ArrowLeft'||e.key==='PageDown'||e.key===' '){e.preventDefault();next()}
  if(e.key==='ArrowRight'||e.key==='PageUp'){e.preventDefault();prev()}
  if(e.key==='Home'){go(0,-1)}
  if(e.key==='End'){go(slides.length-1,1)}
  if(e.key.toLowerCase()==='m'){menu.classList.toggle('open')}
  if(e.key.toLowerCase()==='f'){document.getElementById('fullBtn').click()}
  if(e.key==='Escape'){closeMenu()}
});
deck.addEventListener('touchstart',function(e){var t=e.changedTouches[0];touchX=t.clientX;touchY=t.clientY},{passive:true});
deck.addEventListener('touchend',function(e){
  if(e.target.closest('button'))return;
  var t=e.changedTouches[0],dx=t.clientX-touchX,dy=t.clientY-touchY;
  if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)){dx<0?next():prev()}
},{passive:true});
window.addEventListener('resize',fit);window.addEventListener('orientationchange',fit);fit();
var hm=location.hash.match(/slide-(\d+)/);
if(hm){var n=Number(hm[1])-1;if(n>0)go(n,1)}
progress.style.width=((index+1)/slides.length*100)+'%';
animateCounts(slides[index]);

/* التبويبات العامة */
document.querySelectorAll('[data-tabs]').forEach(function(box){
  var btns=[].slice.call(box.querySelectorAll('.tabs-bar button'));
  var panes=[].slice.call(box.querySelectorAll('.tabpane'));
  btns.forEach(function(b,i){
    b.addEventListener('click',function(){
      btns.forEach(function(x){x.classList.remove('active')});
      panes.forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');panes[i].classList.add('active');
    });
  });
});

/* بوصلة القدرات */
var capData=[
 {ord:'القدرة الأولى',title:'القدرة على الاستشراف',points:['استشراف التهديد','قراءة الاتجاهات'],shift:'من ردة الفعل... إلى الاستباق'},
 {ord:'القدرة الثانية',title:'القدرة على اتخاذ القرار',points:['تحليل البيانات','الذكاء الاصطناعي','إدارة المخاطر','اتخاذ القرار في عدم اليقين'],shift:'من كثرة المعلومات... إلى جودة القرار'},
 {ord:'القدرة الثالثة',title:'القدرة على الابتكار',points:['تصميم حلول جديدة','التجريب','التفكير الإبداعي'],shift:'من تنفيذ الإجراءات... إلى ابتكار الحلول'},
 {ord:'القدرة الرابعة',title:'القدرة على التكامل',points:['العمل متعدد التخصصات','الشراكات الدولية','تبادل المعلومات'],shift:'من العمل المنفرد... إلى العمل الجماعي'},
 {ord:'القدرة الخامسة',title:'القدرة على التكيّف',points:['التعلم المستمر','سرعة الاستجابة','المرونة المؤسسية'],shift:'من الثبات... إلى المرونة'},
 {ord:'القدرة السادسة',title:'القدرة على القيادة',points:['قيادة الفرق','إدارة الأزمات','التأثير','اتخاذ القرار'],shift:'من الإدارة... إلى القيادة'}
];
var capNodes=[].slice.call(document.querySelectorAll('.compass-node'));
var capIndex=document.getElementById('capIndex'),capTitle=document.getElementById('capTitle'),
    capPoints=document.getElementById('capPoints'),capShift=document.getElementById('capShift'),
    capProgress=document.getElementById('capProgress');
function setCap(i){
  var d=capData[i];
  capNodes.forEach(function(n,j){n.classList.toggle('active',j===i)});
  capIndex.textContent=d.ord;capTitle.textContent=d.title;
  capPoints.innerHTML=d.points.map(function(p){return '<li>'+p+'</li>'}).join('');
  capShift.textContent=d.shift;
  [].forEach.call(capProgress.children,function(s,j){s.classList.toggle('active',j===i)});
}
capNodes.forEach(function(n,i){n.addEventListener('click',function(){setCap(i)})});

/* العرض المكبر لبطاقات المسار */
var jzoom=document.getElementById('jzoom');
var jzoomYear=jzoom.querySelector('.jzoom-year');
var jzoomBody=jzoom.querySelector('.jzoom-body');
function closeZoom(){jzoom.classList.remove('open');jzoom.setAttribute('aria-hidden','true')}
document.querySelectorAll('.j-card').forEach(function(c){
  c.addEventListener('click',function(e){
    e.stopPropagation();
    jzoomYear.textContent=c.dataset.year||'';
    jzoomBody.innerHTML=c.innerHTML;
    jzoom.classList.add('open');jzoom.setAttribute('aria-hidden','false');
  });
});
jzoom.addEventListener('click',closeZoom);
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeZoom()});
})();
</script>
</body>
</html>
"""

# ===== لمسات الحيوية والتفاعل =====
for cls in ['cards5','unit-grid','batch-grid','stats-row','agenda-grid','path-flow','course-list','prog-list','prog-list two','lo-list','logo-grid']:
    html = html.replace('class="%s"' % cls, 'class="%s rise-seq"' % cls)
html = html.replace('class="three-col"', 'class="three-col rise-seq"')
html = html.replace('class="three-col compact"', 'class="three-col compact rise-seq"')
for cls in ['glass quote-panel','glass mission-band','glass achieve-band','glass vs-card old','glass vs-card new','glass cap-detail','tabs-bar']:
    html = html.replace('class="%s"' % cls, 'class="%s rise"' % cls)
html = html.replace('<div class="compass" aria-label', '<div class="compass rise" aria-label')
html = re.sub(r'(<section class="slide[^>]*>)', r'\1<div class="aura a1"></div><div class="aura a2"></div>', html)

# ترقيم تلقائي متسلسل للشرائح وعدّاد ديناميكي
parts = html.split('<div class="slide-number">')
html = parts[0]
for i, p in enumerate(parts[1:], 1):
    html += '<div class="slide-number">%02d</div>' % i + p.split('</div>', 1)[1]
total = len(parts) - 1
html = html.replace('<div id="counter">01 / 25</div>', '<div id="counter">01 / %02d</div>' % total)

html = html.replace('%%FONT%%', FONT)
html = html.replace('%%LOGO%%', LOGO)
html = html.replace('%%BG_COVER%%', BG_COVER)
html = html.replace('%%PH_COVER%%', PH_COVER)
html = html.replace('%%PH_QUOTE%%', PH_QUOTE)
html = html.replace('%%PH_DIV1%%', PH_DIV1)
html = html.replace('%%PH_DIV2%%', PH_DIV2)
html = html.replace('%%PH_STUDENTS%%', PH_STUDENTS)
html = html.replace('%%PH_CLOSING%%', PH_CLOSING)
for i in range(1, 7):
    html = html.replace('%%CEN' + str(i) + '%%', globals()['CEN%d' % i])
html = html.replace('%%ACCRED%%', ACCRED)
html = html.replace('%%PARTNERS%%', PARTNERS)
html = html.replace('%%LOGO_ASIS%%', LOGO_ASIS)
html = html.replace('%%LOGO_INTERPOL%%', LOGO_INTERPOL)
html = html.replace('%%LOGO_ACCET%%', LOGO_ACCET)
html = html.replace('%%LOGO_ACCREDITED%%', LOGO_ACCREDITED)
for key in ['EYE','TARGET','LAYERS','CITY','GLOBE','COMPASS','SHIELD','MEDAL','GEAR','BARS']:
    html = html.replace('%%IC_' + key + '%%', globals()['IC_' + key])

out = 'عرض_مستقبل_الأمن.html'
open(out, 'w', encoding='utf-8').write(html)
import os
print(out, os.path.getsize(out))
