function renderKanban(){
  const board=document.getElementById('kanbanBoard');
  if(!board) return;
  const mobile=window.innerWidth<=820;
  const kanbanBusinesses=businesses.filter(b=>isKanban(b)&&!isDiscarded(b));
  board.innerHTML=stages.filter(stage=>stage!=='Descartado').map(stage=>{
    const cards=kanbanBusinesses.filter(b=>statusOf(b)===stage);
    const expanded=kanbanStageExpanded.has(stage)?kanbanStageExpanded.get(stage):cards.length>0;
    const cardsId=`kanban-stage-${safeId(stage)}`;
    const heading=mobile
      ? `<div class="kanban-column-head"><button type="button" data-kanban-toggle="${esc(stage)}" aria-expanded="${expanded}" aria-controls="${cardsId}"><strong>${esc(stage)}</strong><span>${cards.length}</span></button></div>`
      : `<div class="kanban-column-head"><strong>${esc(stage)}</strong><span>${cards.length}</span></div>`;
    return `<section class="kanban-column">${heading}<div class="kanban-cards" id="${cardsId}"${mobile&&!expanded?' hidden':''}>${cards.length ? cards.map(b=>{
      const sid=safeId(b.id);
      const stageControl=canForceSales('changeStage') ? `<select data-kanban-stage="${esc(b.id)}" aria-label="Cambiar etapa de ${esc(b.name)}">${stages.filter(x=>x!=='Descartado').map(x=>`<option ${x===stage?'selected':''}>${x}</option>`).join('')}</select>` : `<span class="meta">${esc(stage)}</span>`;
      return `<article class="kanban-card"><b>${esc(b.name)}</b><div class="meta">${esc(b.zone)} · ${esc(b.category)}</div><div class="meta">${b.score}% afinidad${b.phone ? ` · ${esc(b.phone)}` : ''}</div>${stageControl}<button data-kanban-open="${esc(b.id)}">Ver en mapa</button></article>`;
    }).join('') : '<div class="meta">Sin prospectos</div>'}</div></section>`;
  }).join('') + (kanbanBusinesses.length ? '' : '<div class="kanban-empty">Todavía no hay negocios en Fuerza Comercial. Selecciona negocios en el mapa y pulsa <b>Kanban</b>.</div>');
  board.querySelectorAll('[data-kanban-toggle]').forEach(button=>button.addEventListener('click',()=>{
    const stage=button.dataset.kanbanToggle;
    const expanded=button.getAttribute('aria-expanded')==='true';
    kanbanStageExpanded.set(stage,!expanded);
    renderKanban();
  }));
  board.querySelectorAll('[data-kanban-stage]').forEach(el=>el.addEventListener('change',()=>{
    if(!requireForceSales('changeStage'))return;
    const b=findBusiness(el.dataset.kanbanStage); if(!b)return;
    const c=stateOf(b); c.kanban=true; c.stage=el.value; if(el.value==='Visitado'&&!c.visitedAt)c.visitedAt=new Date().toISOString();
    followups[b.id]={...(followups[b.id]||{}),status:el.value,updatedAt:new Date().toISOString()};
    localStorage.setItem('novaManaguaFollowupsV4',JSON.stringify(followups));persistCommercial();void persistProspectAction(b,'changeStage','',{stage:stageToApi(el.value)});render();toast(`Etapa actualizada: ${el.value}`);
  }));
  board.querySelectorAll('[data-kanban-open]').forEach(el=>el.addEventListener('click',()=>{
    const b=findBusiness(el.dataset.kanbanOpen); if(!b)return;
    activeView='map'; updateView(); pipelineFilter='kanban'; render(); map.flyTo([b.lat,b.lng],16,{duration:.65}); setTimeout(()=>markerById.get(b.id)?.openPopup(),600);
  }));
}
