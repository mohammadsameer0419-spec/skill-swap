-- ============================================
-- Seed Learning Resources
-- ============================================
-- Curated beginner-level resources for immediate access after onboarding
-- Includes YouTube videos and PDF placeholders

-- ============================================
-- Step 1: Ensure categories exist (if not already created by migration)
-- ============================================
-- Categories should already exist from migration 016, but we ensure they exist
INSERT INTO resource_categories (name, slug, description, icon, order_index) VALUES
  ('Getting Started', 'getting-started', 'Resources for new users', '🎯', 1),
  ('Video Tutorials', 'video-tutorials', 'Video guides and tutorials', '🎥', 2),
  ('Practice Exercises', 'practice-exercises', 'Hands-on practice tasks', '💪', 3),
  ('Documentation', 'documentation', 'Detailed guides and references', '📚', 4),
  ('Advanced Topics', 'advanced-topics', 'Expert-level content', '🚀', 5)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Step 2: Insert Python for Beginners Resources
-- ============================================

-- Python YouTube Video 1: Python Full Course for Beginners (freeCodeCamp)
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Python Full Course for Beginners',
  'Complete Python programming course covering basics, data structures, and more. Perfect for absolute beginners.',
  'video',
  (SELECT id FROM resource_categories WHERE slug = 'video-tutorials'),
  'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
  'https://img.youtube.com/vi/_uQrJ0TkZlc/maxresdefault.jpg',
  360,
  'beginner',
  'beginner',
  ARRAY['python', 'programming', 'coding', 'beginner'],
  TRUE,
  NOW()
);

-- Python YouTube Video 2: Python for Everybody (University of Michigan)
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Python for Everybody - Full Course',
  'Comprehensive Python course from University of Michigan. Learn Python from scratch with practical examples.',
  'video',
  (SELECT id FROM resource_categories WHERE slug = 'video-tutorials'),
  'https://www.youtube.com/watch?v=8DvywoVv6XY',
  'https://img.youtube.com/vi/8DvywoVv6XY/maxresdefault.jpg',
  600,
  'beginner',
  'beginner',
  ARRAY['python', 'programming', 'university', 'beginner'],
  TRUE,
  NOW()
);

-- Python YouTube Video 3: Learn Python in 1 Hour
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Learn Python in 1 Hour - Programming with Mosh',
  'Quick introduction to Python programming. Perfect for getting started quickly.',
  'video',
  (SELECT id FROM resource_categories WHERE slug = 'video-tutorials'),
  'https://www.youtube.com/watch?v=kqtD5dpn9C8',
  'https://img.youtube.com/vi/kqtD5dpn9C8/maxresdefault.jpg',
  60,
  'beginner',
  'beginner',
  ARRAY['python', 'programming', 'quick-start', 'beginner'],
  FALSE,
  NOW()
);

-- Python PDF Placeholder
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Python for Beginners - Complete Guide (PDF)',
  'Comprehensive PDF guide covering Python basics, syntax, data types, control flow, and more. Download and study at your own pace.',
  'documentation',
  (SELECT id FROM resource_categories WHERE slug = 'documentation'),
  'https://docs.python.org/3/tutorial/index.html',
  NULL,
  NULL,
  'beginner',
  'beginner',
  ARRAY['python', 'programming', 'pdf', 'guide', 'beginner'],
  TRUE,
  NOW()
);

-- ============================================
-- Step 3: Insert Public Speaking Resources
-- ============================================

-- Public Speaking YouTube Video 1: TED Talk - How to speak so people want to listen
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'How to Speak So People Want to Listen - Julian Treasure',
  'TED Talk on powerful speaking techniques. Learn how to make your voice more engaging and impactful.',
  'video',
  (SELECT id FROM resource_categories WHERE slug = 'video-tutorials'),
  'https://www.youtube.com/watch?v=eIho2S0ZahI',
  'https://img.youtube.com/vi/eIho2S0ZahI/maxresdefault.jpg',
  10,
  'beginner',
  'beginner',
  ARRAY['public-speaking', 'communication', 'ted-talk', 'beginner'],
  TRUE,
  NOW()
);

-- Public Speaking YouTube Video 2: Public Speaking for Beginners
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Public Speaking for Beginners - Complete Course',
  'Step-by-step guide to overcoming fear and delivering confident presentations. Perfect for beginners.',
  'video',
  (SELECT id FROM resource_categories WHERE slug = 'video-tutorials'),
  'https://www.youtube.com/watch?v=7OctUl2r1js',
  'https://img.youtube.com/vi/7OctUl2r1js/maxresdefault.jpg',
  45,
  'beginner',
  'beginner',
  ARRAY['public-speaking', 'presentation', 'confidence', 'beginner'],
  FALSE,
  NOW()
);

-- Public Speaking PDF Placeholder
INSERT INTO learning_resources (
  title,
  description,
  resource_type,
  category_id,
  url,
  thumbnail_url,
  duration_minutes,
  difficulty_level,
  required_level,
  skill_tags,
  is_featured,
  created_at
) VALUES (
  'Public Speaking 101 - Beginner''s Guide (PDF)',
  'Complete guide to public speaking covering preparation, delivery techniques, body language, and overcoming stage fright. Download and practice at your own pace.',
  'documentation',
  (SELECT id FROM resource_categories WHERE slug = 'documentation'),
  'https://www.toastmasters.org/resources/public-speaking-tips',
  NULL,
  NULL,
  'beginner',
  'beginner',
  ARRAY['public-speaking', 'communication', 'pdf', 'guide', 'beginner'],
  TRUE,
  NOW()
);

-- ============================================
-- Step 4: Verify Resources
-- ============================================
-- Check that all resources were inserted
SELECT 
  title,
  resource_type,
  required_level,
  url
FROM learning_resources
WHERE required_level = 'beginner'
ORDER BY created_at DESC;
