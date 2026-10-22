-- Lesson ids lose their number (owner, 2026-10-22): numbers now come from the
-- course order, so "04-shakshuka" is "shakshuka". Only the four written
-- lessons can be in saved data.
UPDATE attempts SET lesson_id = CASE lesson_id WHEN '04-shakshuka' THEN 'shakshuka' WHEN '14-beef-bulgogi' THEN 'beef-bulgogi' WHEN '38-buttermilk-biscuits' THEN 'buttermilk-biscuits' WHEN '49-brown-butter-cookies' THEN 'brown-butter-cookies' ELSE lesson_id END
  WHERE lesson_id IN ('04-shakshuka', '14-beef-bulgogi', '38-buttermilk-biscuits', '49-brown-butter-cookies');
UPDATE fix_requests SET lesson_id = CASE lesson_id WHEN '04-shakshuka' THEN 'shakshuka' WHEN '14-beef-bulgogi' THEN 'beef-bulgogi' WHEN '38-buttermilk-biscuits' THEN 'buttermilk-biscuits' WHEN '49-brown-butter-cookies' THEN 'brown-butter-cookies' ELSE lesson_id END
  WHERE lesson_id IN ('04-shakshuka', '14-beef-bulgogi', '38-buttermilk-biscuits', '49-brown-butter-cookies');
UPDATE lesson_patches SET lesson_id = CASE lesson_id WHEN '04-shakshuka' THEN 'shakshuka' WHEN '14-beef-bulgogi' THEN 'beef-bulgogi' WHEN '38-buttermilk-biscuits' THEN 'buttermilk-biscuits' WHEN '49-brown-butter-cookies' THEN 'brown-butter-cookies' ELSE lesson_id END
  WHERE lesson_id IN ('04-shakshuka', '14-beef-bulgogi', '38-buttermilk-biscuits', '49-brown-butter-cookies');
