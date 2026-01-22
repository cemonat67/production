if(window.location.search.includes("edit=1") && !window.ZERO_ADMIN){
  alert("Demo mode: editing disabled");
  throw new Error("FREEZE");
}
