(this["webpackJsonpsnow-effect"]=this["webpackJsonpsnow-effect"]||[]).push([[0],{17:function(e,t,a){e.exports=a(29)},22:function(e,t,a){},29:function(e,t,a){"use strict";a.r(t);var n=a(1),i=a.n(n),s=a(8),o=a.n(s),c=(a(22),a(9)),r=a(10),l=a(15),h=a(11),d=a(16),u=a(5),m=a.n(u),f=a(2),g=a.n(f),p=a(3),v=a(6),w=a(12),E=a(13),k=a(14);p.b.add(v.a,w.a,E.a);var N=function(e){function t(e){var a;return Object(c.a)(this,t),(a=Object(l.a)(this,Object(h.a)(t).call(this,e))).onResizes={window:function(e){return function(){return a.setSize()}}},a.onClicks={updating:function(e){a.setState({updating:!a.state.updating})}},a.setSize=function(){var e=m()(window).width(),t=m()(window).height();a.setState({width:e,height:t})},a.update=function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:0,t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[],n=a.state,i=n.width,s=n.height,o=n.updating,c=n.fps;if(o){var r=a.canvas.getContext("2d");if(r.fillStyle="#333",r.fillRect(0,0,i,s),e%(c/10)===0){var l=t.length>0?g.a.random(0,2):g.a.random(5,10);g.a.chain(l).range().forEach((function(e){var a={x:g.a.random(i),y:0,z:g.a.random(-5,5),size:g.a.random(2,5),degree:0};return t.push(a),!0})).value(),a.setState({count:t.length})}g.a.forEach(t,(function(e){var t=e.x,a=e.y,n=e.z,i=e.size,o=e.degree,c=.75+.5*n;return r.beginPath(),r.fillStyle="rgba(255, 255, 255, ".concat(c,")"),r.arc(t+10*Math.cos(o/360*2*Math.PI),a,i,0,2*Math.PI),r.fill(),r.closePath(),a+i<s&&(e.y+=i,e.degree+=3,e.degree%=360),!0}))}var h=setTimeout(a.update,1e3/c,(e+1)%c,t);a.setState({updateTask:h})},a.state={width:0,height:0,updating:!1,updateTask:-1,fps:0,count:0},a}return Object(d.a)(t,e),Object(r.a)(t,[{key:"componentDidMount",value:function(){this.setSize(),m()(window).on("resize",this.onResizes.window);var e=setTimeout(this.update);this.setState({updating:!0,updateTask:e,fps:60})}},{key:"componentWillUnmount",value:function(){clearTimeout(this.state.updateTask)}},{key:"render",value:function(){var e=this;return i.a.createElement("div",{className:"container-fluid"},i.a.createElement("canvas",{ref:function(t){return e.canvas=t},width:this.state.width,height:this.state.height,style:{position:"fixed",left:0,top:0}}),i.a.createElement("div",{className:"row mt-4"},i.a.createElement("div",{className:"col col-12"},i.a.createElement("button",{onClick:this.onClicks.updating},i.a.createElement(k.a,{icon:this.state.updating?v.a.faPause:v.a.faPlay})))),i.a.createElement("div",{className:"row mt-4"},i.a.createElement("div",{className:"col col-12"},i.a.createElement("pre",{className:"text-light"},"width: ",this.state.width),i.a.createElement("pre",{className:"text-light"},"height: ",this.state.height),i.a.createElement("pre",{className:"text-light"},"updating: ",JSON.stringify(this.state.updating)),i.a.createElement("pre",{className:"text-light"},"count: ",this.state.count))),i.a.createElement("div",{className:"row"},i.a.createElement("div",{className:"col col-12"})),i.a.createElement("div",{className:"row"},i.a.createElement("div",{className:"col col-12"})))}}]),t}(i.a.Component);Boolean("localhost"===window.location.hostname||"[::1]"===window.location.hostname||window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/));o.a.render(i.a.createElement(N,null),document.getElementById("root")),"serviceWorker"in navigator&&navigator.serviceWorker.ready.then((function(e){e.unregister()}))}},[[17,1,2]]]);
//# sourceMappingURL=main.557fd90f.chunk.js.map