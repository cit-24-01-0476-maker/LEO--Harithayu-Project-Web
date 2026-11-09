// Seed positions follow verification order, so an older donor's plants do not
// disappear when a newer donation arrives. Only consented public names reach here.
export function seedlingOwners(donors, capacity) {
  const ordered=[...donors].sort((a,b)=>String(a.confirmed_at).localeCompare(String(b.confirmed_at))||String(a.id).localeCompare(String(b.id)));
  const owners=[];let amount=0;
  for(const donor of ordered){amount+=donor.amount;const end=Math.min(capacity,Math.floor(amount/100));while(owners.length<end)owners.push(donor);if(owners.length===capacity)break;}
  return owners;
}
