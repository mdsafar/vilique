-- Message/body edits are content edits, not event identity changes.

create or replace function public.vilique_assess_event_identity_change(snapshot jsonb, proposed jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  score integer := 0;
  signals text[] := array[]::text[];
  original_category text := snapshot->>'original_category';
  original_primary_name text := snapshot->>'original_primary_name';
  original_secondary_name text := coalesce(snapshot->>'original_secondary_name', '');
  original_event_date text := snapshot->>'original_event_date';
  original_template_id text := coalesce(snapshot->>'original_template_id', '');
  original_venue text := trim(concat_ws(' ', snapshot->>'original_venue_name', snapshot->>'original_venue_address'));
  proposed_category text := proposed->>'category';
  proposed_primary_name text := proposed->>'primaryName';
  proposed_secondary_name text := coalesce(proposed->>'secondaryName', '');
  proposed_event_date text := proposed->>'eventDate';
  proposed_template_id text := coalesce(proposed->>'templateId', '');
  proposed_venue text := trim(concat_ws(' ', proposed->>'venueName', proposed->>'venueAddress'));
  similarity numeric;
  date_diff integer;
  risk_level text := 'low';
  decision text := 'allowed';
  reason text := 'Changes classify as same-event corrections or legitimate rescheduling.';
begin
  if proposed_category is not null and proposed_category <> original_category then
    if (original_category = 'wedding' and proposed_category = 'engagement')
       or (original_category = 'engagement' and proposed_category = 'wedding')
       or (original_category = 'party' and proposed_category = 'birthday')
       or (original_category = 'birthday' and proposed_category = 'party') then
      score := score + 30;
    else
      score := score + 55;
    end if;
    signals := array_append(signals, 'Category changed.');
  end if;

  similarity := public.vilique_token_similarity(
    concat_ws(' ', original_primary_name, original_secondary_name),
    concat_ws(' ', proposed_primary_name, proposed_secondary_name)
  );

  if similarity < 0.2 then
    score := score + 45;
    signals := array_append(signals, 'Host/couple names appear completely replaced.');
  elsif similarity < 0.55 then
    score := score + 25;
    signals := array_append(signals, 'Host/couple names changed significantly.');
  elsif similarity < 0.9 then
    score := score + 8;
    signals := array_append(signals, 'Host/couple names changed slightly.');
  end if;

  if proposed_event_date is not null and proposed_event_date <> original_event_date then
    date_diff := public.vilique_date_diff_days(original_event_date, proposed_event_date);
    if date_diff is not null then
      if date_diff > 365 then
        score := score + 28;
        signals := array_append(signals, 'Event date moved by more than one year.');
      elsif date_diff > 180 then
        score := score + 22;
        signals := array_append(signals, 'Event date moved by more than six months.');
      elsif date_diff > 90 then
        score := score + 12;
        signals := array_append(signals, 'Event date moved by more than three months.');
      elsif date_diff > 30 then
        score := score + 5;
        signals := array_append(signals, 'Event date moved by more than one month.');
      end if;
    end if;
  end if;

  if original_venue <> '' and proposed_venue <> '' then
    similarity := public.vilique_token_similarity(original_venue, proposed_venue);
    if similarity < 0.2 then
      score := score + 22;
      signals := array_append(signals, 'Venue appears completely replaced.');
    elsif similarity < 0.5 then
      score := score + 10;
      signals := array_append(signals, 'Venue changed significantly.');
    end if;
  end if;

  if proposed_template_id <> '' and proposed_template_id <> original_template_id then
    score := score + 20;
    signals := array_append(signals, 'Template changed after first publish.');
  end if;

  if cardinality(signals) >= 3 then
    score := score + 10;
  end if;

  if cardinality(signals) >= 4 then
    score := score + 10;
  end if;

  if score >= 70 then
    risk_level := 'high';
    decision := 'blocked';
    reason := 'This looks like a different event. Your purchase covers one published event. Create a new invitation for this event.';
  elsif score >= 35 then
    risk_level := 'medium';
    decision := 'warned';
    reason := 'This looks like a major update to your invitation.';
  end if;

  return jsonb_build_object(
    'riskLevel', risk_level,
    'decision', decision,
    'score', score,
    'reason', reason,
    'signals', to_jsonb(signals)
  );
end;
$$;
