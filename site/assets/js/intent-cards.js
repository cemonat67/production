document.querySelectorAll(".intent-card").forEach(card => {
  card.addEventListener("click", () => {
    const intent = card.dataset.intent;
    const url = `/synapse/brain/resolve`;
    fetch(url,{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        context:{
          product:"production",
          page:"index",
          role: intent === "cost" ? "cfo" : intent === "flow" ? "cto" : "ceo",
          intent_hint:intent
        }
      })
    })
    .then(r=>r.json())
    .then(j=>{
      if(j?.action?.target){
        window.location.href = j.action.target;
      }
    });
  });
});
