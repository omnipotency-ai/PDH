# Precision Morphometry and Neuro-Inclusive Architectures in Digital Gastroenterology
## A Multimodal Framework for Surgical Recovery and Patient Adherence

The evolution of clinical gastroenterology is increasingly defined by the transition from subjective patient-reported outcomes to objective, high-fidelity digital biomarkers. At the epicenter of this shift is the integration of computational stool morphometry, real-time surgical monitoring systems, and neuro-inclusive design frameworks. This convergence addresses a fundamental weakness in traditional gastrointestinal care: the reliance on retrospective, qualitative data that is inherently susceptible to recall bias and cognitive variability.

By utilizing computer vision to objectify human excreta, platforms like Dieta Health provide a level of granular insight into gut physiology that was previously inaccessible outside of a laboratory setting.[1, 2] Simultaneously, the application of artificial intelligence in the perioperative continuum—through systems such as FluidAI and MySurgeryRisk—is redefining the detection of life-threatening complications like anastomotic leaks and postoperative ileus.[3, 4]

However, the clinical utility of these high-precision tools is contingent upon sustained patient engagement, which is often compromised in neurodivergent populations due to executive function challenges. The development of neuro-inclusive adherence frameworks is therefore not merely an accessibility concern but **a prerequisite for the integrity of the predictive algorithms that drive modern digital health interventions**.[5, 6, 7]

---

## The Technological Foundations of Computational Stool Morphometry

The foundational innovation of digital gastrointestinal platforms lies in the ability to convert a common physiological output—stool—into a structured dataset. Computational stool morphometry involves the use of deep learning and computer vision to analyze images of bowel movements, extracting clinically validated metrics that correspond to underlying physiological states.

This process addresses the significant discrepancies found in human self-reporting. Research conducted by Dieta Health and validated by the Medically Associated Science and Technology (MAST) Program at Cedars-Sinai indicates that patients struggle to accurately categorize their stool according to the Bristol Stool Scale (BSS), often leading to skewed clinical data.[2]

### Architectural Mechanisms of Computer Vision in Stool Analysis

The AI models employed in platforms like Dieta are trained on thousands of specialist-annotated images to identify specific morphological characteristics. Unlike the traditional BSS, which provides a single numerical value (1–7) based on visual appearance, **computational morphometry decomposes each bowel movement into a multidimensional vector of data points**. These include:

- **Consistency** — the liquid-to-solid ratio
- **Fragmentation** — the degree of division into separate pieces
- **Edge fuzziness** — the clarity of the stool's borders
- **Volume**

Recent iterations of these platforms have incorporated the detection of auxiliary indicators such as mucus, blood, and specific color variations, which are essential for the longitudinal monitoring of Inflammatory Bowel Disease (IBD) and Cirrhosis.[1]

The precision of these models is quantified through sensitivity and specificity metrics that significantly outperform manual patient reporting. In head-to-head comparisons, the Dieta AI demonstrated a sensitivity of 83% and a specificity of 94%, whereas patients managed only 55% and 71%, respectively.[1, 9]

> This performance delta highlights the **"observer effect"** in medical diagnostics: when patients are asked to remember and classify their own biological outputs, cognitive load and bias often obscure the objective reality of the event.

| Metric | AI Performance | Patient Self-Reporting | Accuracy Gain |
|---|---|---|---|
| Sensitivity (Stool Classification) | 83% | 55% | 28% |
| Specificity (Stool Classification) | 94% | 71% | 23% |
| Correlation to Symptom Severity | 0.71 | 0.46 | 0.25 |

The high correlation (r=0.71) between AI classifications and overall symptom severity scores, compared to the lower correlation (r=0.46) for patient-led classifications, suggests that the AI is detecting **sub-perceptual changes** in stool morphology—such as "edge fuzziness"—that are indicative of gut health but invisible to the untrained eye.[2]

### Biomarker Correlation and Physiological Insights

The clinical relevance of computational morphometry extends beyond simple classification; it serves as a proxy for systemic inflammation and microbiome activity. In patients with acute severe ulcerative colitis (ASUC), AI-measured BSS and fragmentation scores have shown statistically significant positive correlations with C-reactive protein (CRP) values (p=0.026 and p=0.049), while stool consistency was negatively correlated with CRP (p=0.047).[1]

This relationship allows clinicians to monitor the inflammatory state of the colon non-invasively, reducing the need for frequent invasive procedures or expensive laboratory tests.

Furthermore, stool morphometry provides a window into the efficacy of pharmacological interventions. In managing hepatic encephalopathy (HE), patients must titrate their lactulose dosage to achieve a specific stool consistency. AI-driven analysis of stool images enabled patients to refine this titration, with the correlation between dosage adjustments and AI-measured consistency improving from r=0.82 to r=0.92 over a ten-day period.[1] This high-resolution feedback loop demonstrates how digital health platforms can empower patients to manage complex medication regimens with greater precision.

---

## Artificial Intelligence in the Surgical Continuum

The application of AI in surgical gastroenterology aims to mitigate the high risk of complications that characterize major resections and abdominal procedures. Over 30% of patients undergoing major GI surgery experience a significant complication, with nearly half of these occurring after hospital discharge.[10] The shift toward Enhanced Recovery After Surgery (ERAS) protocols has emphasized early mobilization and rapid return of bowel function, yet traditional monitoring remains episodic and reactive.

### Early Detection of Anastomotic Leaks

Anastomotic leaks (AL) are among the most feared complications in colorectal and gastric surgery, often leading to sepsis, peritonitis, and mortality. Conventional detection of AL relies on the appearance of clinical symptoms (fever, pain, tachycardia) or radiological evidence, both of which often manifest late in the disease progression.[11]

AI-powered monitoring platforms like **FluidAI (FluidAI Stream™)** utilize advanced nanosensors to continuously analyze the biochemical composition of surgical drainage.[3, 4] The FluidAI "Origin" device attaches directly to surgical drains and monitors parameters such as pH and electrical conductivity. Machine learning models integrated into the system can identify patterns "invisible to the human eye," **potentially predicting an AL up to six days before clinical symptoms emerge**.[3, 12] This proactive capability is critical for reducing the $5,000 average additional cost per leak event and, more importantly, improving survival rates.[12]

| System Component | Technology | Target Complication | Clinical Benefit |
|---|---|---|---|
| FluidAI Origin™ | Biochemical Nanosensors (pH, Conductivity) | Anastomotic Leaks | Detection up to 6 days early |
| MySurgeryRisk | Real-time EHR Integration | Sepsis, AKI, Major Complications | Superior to clinician judgment |
| G-POCUS | Bedside Point of Care Ultrasound | Delayed Bowel Function (DBF), POI | Guides NGT placement and feeding |

### Predicting Postoperative Ileus and Delayed Bowel Function

Postoperative ileus (POI), characterized by the transient cessation of gastrointestinal motility, is a major driver of prolonged hospital stays. Diagnosing POI is traditionally based on clinical acumen and physical exams, which are notoriously subjective.[13, 14]

Emerging AI models are now leveraging Point of Care Ultrasound (G-POCUS) and wearable activity trackers to provide objective data on gut recovery:

- **G-POCUS** — gastric volume measurements on the first postoperative day (POD1) can predict the incidence of delayed bowel function, allowing evidence-based decisions regarding nasogastric tube (NGT) placement or the initiation of oral feeding.[14]
- **Wearable sensors** (e.g., Mindray ePM/ep pod) — track physical activity, which is negatively correlated with the Comprehensive Complication Index (CCI). Analysis of activity on POD3 found that increased movement time significantly reduced 30-day CCI scores (p=0.01), with a peak reduction observed at 215 minutes of activity.[15, 16]

These findings suggest that the integration of activity feedback and automated symptom tracking can create a robust early warning system for surgical teams.

---

## Microbiota Alterations and Surgical Recovery Profiles

The success of surgical interventions is increasingly understood to be linked to the state of the gut microbiome. Surgeries like colorectal cancer (CRC) resection or bariatric bypass induce **site-specific changes in microbiota composition** that directly influence inflammation and mucosal healing.[17, 18]

### The Impact of Resection on Microbial Diversity

Different surgical sites lead to distinct shifts in the pro-inflammatory and anti-inflammatory profiles of the gut. For instance, Right-Sided Colectomy (RSC) often results in a more significant reduction in alpha diversity compared to other procedures, likely due to the loss of the ileocecal valve.[17]

| Bacterial Taxa | Change Post-Surgery | Clinical Implication |
|---|---|---|
| *F. prausnitzii* | Decreased (RSC & LSC) | Reduced butyrate production; impaired mucosal healing |
| *Bifidobacterium* spp. | Decreased | Transition toward pro-inflammatory profile |
| *E. coli* | Increased (RSC) | Production of genotoxin colibactin; risk of recurrence |
| *A. muciniphila* | Increased (LSC) | Enhanced barrier integrity; potential biomarker for recovery |

The depletion of short-chain fatty acid (SCFA)-producing bacteria like *F. prausnitzii* is particularly concerning, as these metabolites are crucial for maintaining the intestinal barrier and preventing infections such as anastomotic leakage.[17] Conversely, the enrichment of *A. muciniphila* in Left-Sided Colectomy (LSC) patients suggests a more favourable environment for postoperative immunity.[17] Automated stool morphometry can assist in monitoring these shifts by identifying changes in BSS and fragmentation that correlate with microbial dysbiosis.[1]

### Bariatric Surgery and Bowel Habit Evolution

Bariatric procedures (RYGB, SG, AGB) produce operation-specific alterations in bowel habits:

- **Roux-en-Y gastric bypass (RYGB)** and **Biliopancreatic Diversion (BPD)** — typically associated with an increase in loose stools and diarrhea
- **Adjustable Gastric Banding (AGB)** — more frequently results in constipation

Data from longitudinal studies show that after bariatric surgery, dietary fiber intake often drops significantly (from 24.4 to 17.5 g/day, p=0.008), leading to firmer stools and prolonged intestinal transit times.[18] Monitoring these changes with AI-driven stool analysis allows for more nuanced postoperative counseling and nutritional adjustment.

---

## Neurodivergent Adherence Frameworks: The Cognitive Imperative

The clinical potential of digital GI health platforms is undermined if the target population cannot adhere to the monitoring protocols. This is particularly relevant for neurodivergent individuals—those with ADHD, Autism (ASD), or Dyslexia—who represent a significant portion of the patient population with chronic GI issues. These individuals often face **"executive function" barriers** that make traditional logging apps difficult to use.[7, 20, 21]

### Neuroscience of Executive Dysfunction and Habit Formation

Executive function (EF) is the "project management system" of the brain, involving working memory, task initiation, planning, and impulse control.[22] In neurodivergent brains, these systems often function differently. For instance, the ADHD brain is characterized by differences in dopamine signaling within the frontostriatal networks, making tasks that require internal reminders and delayed rewards—like consistent symptom logging—uniquely difficult.[20]

For an autistic or ADHD individual, the process of habit formation is not simply a matter of repetition. The "effortful" phase of a new routine draws heavily on EF. If a digital health app requires multiple steps to log a meal or a stool (e.g., navigating through menus, typing descriptions), it increases cognitive load and risks triggering a "freeze" response.[7, 23] Key barriers include:

- **Task Initiation and Friction** — The transition from the intent to track to the actual action is where most adherence failures occur. Reducing initiation effort (e.g., through one-tap photo capture) is a critical intervention.[7]
- **Working Memory and Externalization** — Because working memory can only hold 3–4 "chunks" of information, neuro-inclusive design must prioritize "cognitive offloading"—moving information from the brain to the digital environment.[22]
- **Time Blindness** — Time perception challenges in ADHD mean that daily or hourly reminders must be visual and concrete (e.g., a "Time Timer" visual countdown) rather than just a generic notification.[22]

### The SPELL Framework and Positive Digital Support

To address these challenges, designers are adopting the **SPELL framework** (Structure, Positive approaches, Empathy, Low arousal, Links) to guide the development of AI health tools.[24]

1. **Structure** — Using predictable layouts and clear progress indicators (e.g., "Step 2 of 3") to lower anxiety and clarify task completion.[5, 6]
2. **Positive Approaches** — Utilizing "strength-based" gamification. For example, Habitica transforms to-do lists into a Role-Playing Game (RPG) where users earn experience points for tracking health metrics, providing the immediate dopamine reward that ADHD brains crave.[25, 26]
3. **Empathy and Low Arousal** — Designing "Calm Modes" that eliminate auto-playing media, mute color palettes, and use non-blaming error messages. This prevents sensory overload in autistic users.[5, 23]

| UX Principle | ADHD Application | ASD Application | Impact on GI Tracking |
|---|---|---|---|
| Progressive Disclosure | Prevents overwhelm from complex forms | Reduces anxiety through predictable steps | Increases completion of long symptom diaries |
| Literal Labeling | Clarifies ambiguous icons | Reduces cognitive load of interpretation | Ensures accurate data entry |
| Motion Control | Minimizes distractions during logging | Prevents sensory distress/dizziness | Increases app dwell time and engagement |
| Smart Defaults | Reduces redundant input | Provides a consistent baseline | Minimizes "friction" for daily tracking |

---

## Digital Phenotyping: Stool Analysis as a Cognitive Proxy

The intersection of computational stool morphometry and neurodivergence reveals a profound diagnostic opportunity. Emerging research into **"digital phenotyping"** uses telemetry from smartphones—keystroke dynamics, sensor patterns, and frequency of social interaction—to monitor mental health and neurodevelopmental status.[27, 28] Computational stool analysis can be viewed as a biological layer of this digital phenotype.

### Stool Morphometry in Autism Research

Computer vision tools are already being used to objectively assess behavioral biomarkers in children with autism, such as eye tracking and movement patterns.[29, 30] Given the high prevalence of GI issues in the autistic population, AI-driven stool analysis provides a **non-verbal, non-invasive** way to monitor physical discomfort that may manifest as behavioral dysregulation.[30, 31] The "Auggi" platform and similar Cornell Tech projects demonstrate that by capturing stool images in the home environment, researchers can gain unbiased data that is far more reliable than caregiver observation alone.[30, 32]

### Executive Function Offloading through AI

For the neurodivergent patient, the AI in a GI app functions as an **"executive function proxy."** When a user takes a photo of their stool, the AI performs the complex cognitive task of categorization (consistency, volume, fragmentation). This eliminates the need for the user to understand or remember the Bristol Scale, reducing the cognitive energy required for adherence.[22, 33] Recent scholarship suggests that Large Language Model (LLM) chatbots like ChatGPT can further bridge this gap by translating neurotypical clinical instructions into structured, manageable tasks for the user.[33]

---

## Ethical Governance and the "Disabled Data" Gap

The deployment of these advanced technologies necessitates a robust ethical and regulatory framework to prevent bias and protect patient privacy. AI systems are fundamentally limited by their training data. If neurodivergent populations are excluded from the initial data collection phases—due to the very adherence barriers we seek to address—**the resulting algorithms will be biased toward neurotypical physiological and behavioral patterns**.[34, 35]

### Algorithmic Bias and Inclusivity

Algorithms trained on "convenience samples" risk embedding historical health disparities. For instance, commercial algorithms that use cost as a proxy for illness have been shown to exhibit racial bias.[35] In the context of disability, **"exclusion bias"** occurs when neurodivergent users are systematically left out of data analysis.[35, 36] Addressing this requires a "Participatory Co-Design" approach, where autistic and ADHD users are involved in the development of the AI models from the conception phase.[37, 38]

### Privacy and the Zero-Knowledge Framework

The collection of sensitive data—including images of stool and granular behavioral telemetry—presents significant privacy risks. While HIPAA and GDPR provide baseline protections, the "Passive and pervasive nature" of digital phenotyping requires more advanced safeguards.[39, 40, 41]

One proposed solution is a **"Zero-Knowledge Framework."** In this model, machine learning for stool classification or behavioral markers occurs on the user's device. The system then generates a Zero-Knowledge Proof (ZKP) that validates the diagnostic result without revealing the raw, sensitive telemetry or images to a central server.[27] This approach overcomes the "Privacy Paradox," encouraging broader adoption among vulnerable populations who might otherwise fear data misuse.[27]

| Governance Action | Regulatory Alignment | Target Risk |
|---|---|---|
| Algorithmic Audits | EU AI Act / HHS Playbook | Bias and disparate impact on subgroups |
| Datasheets for Datasets | Transparency Standards | Incomplete representation of neurodivergent data |
| Human-in-the-Loop | Ethical AI Guidelines | Opaque automated decision-making |
| Zero-Knowledge Proofs | GDPR (Privacy by Design) | Unauthorized access to sensitive biological data |

---

## Synthesis and Future Outlook: The "Digital Twin" of GI Health

The integration of computational stool morphometry, surgical outcome prediction, and neuro-inclusive design creates a **"Digital Twin" model of the patient**. This model is a continuous, data-rich representation of the patient's gut physiology and behavioral patterns, allowing for "augmented gastroenterology".[32]

In this future paradigm, a patient undergoing colorectal surgery is not merely "monitored" through episodic visits. Instead:

1. **Continuous Monitoring** — Sub-surface drains (like FluidAI's Origin) monitor for biochemical signs of leaks.[3]
2. **Objective Activity Feedback** — Wearables track movement, providing visual cues to the patient to reach target activity levels that reduce complication risk.[16, 42]
3. **Automated Morphometry** — The patient uses a neuro-inclusive mobile app to snap photos of their recovery-phase stools. The AI detects "fragmentation" or "mucus" changes that might precede clinical inflammation.[1]
4. **Executive Scaffolding** — The app's design uses "Calm Mode" and "Progressive Disclosure" to ensure the patient—even if dealing with postoperative "brain fog" or pre-existing ADHD—can easily complete these tasks.[6, 23]

This holistic approach addresses the "Functionality, Workflow, Meaningfulness, and Actionability" barriers that currently hinder post-surgical monitoring.[10] By moving from qualitative guesses to quantitative measurements, and from neurotypical assumptions to neuro-inclusive realities, digital health platforms can finally realize the promise of personalized, equitable, and effective gastrointestinal care.

### Implications for the Healthcare Ecosystem

The broader impact of these technologies on the healthcare ecosystem is multi-faceted:

- By providing clinicians with an objective, continuous log of digestive health, platforms like Dieta reduce the administrative burden on providers and allow for faster, more precise treatment decisions.[8, 43]
- For the patient, especially the neurodivergent patient, these tools provide autonomy and reduce the isolation and stigma associated with chronic gut disorders.[32, 44]

Ultimately, the shift toward computational morphometry and neuro-inclusive design is a move toward a **"fairer healthcare system"**.[45] By ensuring that the most vulnerable populations—those with cognitive heterogeneity and high-stakes surgical needs—are the focus of design rather than an afterthought, the medical community can build a more resilient and inclusive diagnostic future. The data is clear: the most accurate diagnostics are those that remove human error, and the most effective health interventions are those that meet patients exactly where their brains work.[2, 7, 24]

---

## Deep Dive: Morphometric Parameters as Indicators of Inflammation

The correlation between AI-measured fragmentation and C-reactive protein (CRP) in ASUC patients requires a nuanced understanding of the physiological mechanisms involved. Fragmentation, in the context of stool morphometry, refers to the degree to which a bowel movement is broken into separate pieces before or during evacuation. In inflammatory states, the intestinal mucosa is often friable and secretes excess mucus and protein-rich exudate. This alters the rheology of the stool, often leading to smaller, more divided passages that the AI captures as high "fragmentation".[1]

The "edge fuzziness" metric, another proprietary Dieta feature, likely captures the presence of microscopic levels of mucus or the lack of solid structural integrity that occurs when transit time is accelerated by inflammation. When the AI detects a high level of "fuzziness" combined with liquid consistency, it provides a quantitative signal of active disease that a patient might simply describe as "diarrhea." By objectifying these nuances, the AI provides a continuous data stream that is **28% more sensitive than the patient's own observations**.[1, 2]

### The Role of Lactulose Titration in Hepatic Encephalopathy

The use of AI-BSS to guide lactulose titration in cirrhosis patients is a landmark application of personalized medicine. Hepatic Encephalopathy (HE) is caused by the accumulation of neurotoxins (like ammonia) that the liver can no longer clear. Lactulose works by acidifying the gut and acting as an osmotic laxative to speed the excretion of these toxins. However, the **therapeutic window is narrow**: too little lactulose leads to toxin buildup, while too much leads to dehydration and electrolyte imbalance.

The finding that AI tools helped patients achieve a correlation of r=0.92 between dose adjustment and stool consistency is evidence that real-time morphometric feedback can effectively replace the "guesswork" that traditionally plagues HE management.[1] This precision reduces the risk of HE recurrence, which is a major cause of hospital readmission and a significant economic burden on the healthcare system.

### Technical Detail: Training Computer Vision for Stool Analysis

The development of these AI models relies on a process known as "Augmented Gastroenterology." Because there were no existing large-scale databases of annotated stool images, platforms like Auggi and Dieta had to build proprietary datasets through crowd-sourcing and specialist partnerships.[30, 32] These images are "cleaned" and then annotated by a team of expert physicians who provide the "gold standard" labels.[2, 32]

Deep learning techniques, specifically **Convolutional Neural Networks (CNNs)**, are then deployed to learn the features of these images. The model is trained to recognize patterns across different lighting conditions, toilet types, and background colors. This "unconstrained scenario" training is what allows the app to function in a patient's home—the "natural environment"—rather than just in a controlled clinical setting.[31, 32] The success of this approach is validated by the fact that the AI's accuracy is now "comparable to expert gastroenterologists".[2]

---

## Expanding Post-Surgical Recovery: The Role of Microbiome-Targeted Strategies

The observation that Right-Sided Colectomy (RSC) leads to a transition toward a **"pro-inflammatory microbial profile"** (increased *E. coli*, decreased *F. prausnitzii*) has profound implications for post-surgical care.[17] If a surgical team knows that an RSC patient is at a higher risk of inflammation and colibactin-induced DNA damage, they can implement microbiome-targeted strategies, such as specific prebiotic or probiotic regimens, to restore SCFA producers.

Automated stool tracking becomes the primary tool for monitoring the success of these interventions. A shift toward firmer stools (lower BSS) and reduced fragmentation would indicate a slowing of transit time and an improvement in the mucosal environment, signaling that the "favorable microbial environment" seen in LSC patients is being replicated.[17, 18]

---

## Cognitive Load and the "Double-Edged Sword" of AI

While AI offers immense benefits, it also presents a **"double-edged sword"** for neurodivergent populations. AI can help reduce health disparities by identifying patterns in large datasets that might indicate a higher risk for certain conditions.[46] However, there is a risk that "human-like" AI agents might exclude autistic perspectives if they are programmed with "neuronormative" benchmarks.[47, 48]

For example, an AI "digital coach" that uses overly social or metaphorical language might be confusing for literal-thinking autistic users. Instead, neuro-inclusive AI must prioritize:

- **Plain English** and literal labeling
- **Bidirectional translation** between neurotypical and neurodivergent communication styles[5, 33, 49]

By adopting the **"Curb Cut Effect"**—designing for the "edge cases" of neurodiversity—platforms improve the experience for all users, as a simpler, more predictable interface is a "universal joy".[44, 49]

---

## Final Synthesis: Toward a Holistic AI-Gastroenterology Ecosystem

The convergence of computational stool morphometry, real-time surgical monitoring, and neuro-inclusive adherence frameworks represents a fundamental restructuring of gastroenterology. We are moving away from a world of "episodic spot-checks" toward a world of **"friction-less, 24-hour data capture"**.[42] In this ecosystem:

- **Precision** is provided by AI morphometry.[1]
- **Safety** is ensured by surgical predictive models.[3]
- **Equity** is achieved through neuro-inclusive design.[6]
- **Privacy** is protected by Zero-Knowledge frameworks.[27]

This integrated framework ensures that the "right level of support is provided at the right time," leading to a tech-forward, human-first approach to digestive health.[43] By objectifying the subjective and including the excluded, digital health platforms can finally fulfill their promise to transform the lives of **the 11% of the global population** suffering from digestive disorders.[2]

---

## References

1. Blog — Dieta: Personalized Digestive Health, https://dietahealth.com/blog
2. Published Clinical Study: Dieta's Stool Image AI is Validated as Superior to Gastroenterology's Industry Standard, https://dietahealth.com/blog/2023/5/10/published-clinical-study-dietas-stool-image-ai-is-validated-as-superior-to-gastroenterologys-industry-standard
3. (PDF) Artificial Intelligence in Surgical Gastroenterology: From Predictive Models to Intraoperative Guidance, https://www.researchgate.net/publication/395728510
4. Mitacs empowers safer and smarter post-op care with Fluid AI, https://www.mitacs.ca/our-innovation-insights/mitacs-empowers-safer-and-smarter-post-op-care-with-fluid-ai/
5. Neurodiversity In UX: 7 Key Design Principles, https://devqube.com/neurodiversity-in-ux/
6. Designing for Neurodivergence — 16 UX Principles to Truly Include Neurodivergent Users, https://medium.com/design-bootcamp/beyond-compliance-16-ux-principles-to-truly-include-neurodivergent-users-e7d3ff779665
7. Why Building Habits Is Harder for ADHD and Autistic Brains, https://feno.co/blogs/news/why-building-habits-is-harder-for-adhd-and-autistic-brains-and-what-actually-helps
8. Clinicians — Dieta: Personalized Digestive Health, https://dietahealth.com/clinicians
9. Dieta's Stool Image AI is Validated as Superior to Gastroenterology's Industry Standard, PR Newswire, https://www.prnewswire.com/news-releases/301518414.html
10. Barriers and Facilitators to Implementing Patient-Reported Outcome Monitoring in Gastrointestinal Surgery — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC11187775/
11. Colorectal • FluidAI Medical, https://fluidai.md/colorectal/
12. Origin — FluidAI Medical, https://fluidai.md/origin/
13. Gastrointestinal Electrical Stimulation as Prevention of Postoperative Ileus — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12534573/
14. Study Details | NCT05796063 | Postoperative Gastric Point of Care Ultrasound (G-POCUS), https://clinicaltrials.gov/study/NCT05796063
15. Impact of Mobilization Facilitated by Wearable Device — JMIR mHealth, https://mhealth.jmir.org/2026/1/e70534
16. Impact of Mobilization Facilitated by Wearable Device — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12858115/
17. Postoperative Gut Microbiota Changes after Colorectal Cancer Surgery — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12574805/
18. The Effects of Bariatric Procedures on Bowel Habit — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC5018031/
19. Bowel habits after bariatric surgery — PubMed, https://pubmed.ncbi.nlm.nih.gov/18327626/
20. Self-Care, Routine, & ADHD: Building Habits When the Brain Doesn't Cooperate, https://remedypsychiatry.com/self-care-routine-adhd-building-habits-when-the-brain-doesnt-cooperate/
21. Experiences of an internet-based support and coaching model for adolescents and young adults with ADHD and ASD — ResearchGate, https://www.researchgate.net/publication/322584496
22. Executive Functioning Support for ADHD and Autistic Brains — Neurodivergent Insights, https://neurodivergentinsights.com/executive-function-helpers/
23. Neuro-Inclusive Design: 8 Practical Tips for Digital Spaces — accessiBe, https://accessibe.com/blog/knowledgebase/how-to-design-digital-environments-for-people-with-neuro-divergency
24. AI Empowers Autism Nutritional Care Solutions — ResearchGate, https://www.researchgate.net/publication/391647245
25. A Neuroaffirmative, Self-Determination Theory–Based Psychosocial Intervention for Adults With ADHD — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12612647/
26. 12 Apps to Support Autistic Young Adults with Executive Function Skills, https://cipworldwide.org/learning-hub/executive-functioning/12-apps-to-support-autistic-young-adults-with-executive-function-skills/
27. Privacy-Preserving Digital Phenotyping: A Zero-Knowledge Framework — IJFMR, https://www.ijfmr.com/research-paper.php?id=71751
28. Ethical Development of Digital Phenotyping Tools for Mental Health Applications — JMIR mHealth, https://mhealth.jmir.org/2021/7/e27343
29. Computer vision and behavioral phenotyping: an autism case study — PubMed, https://pubmed.ncbi.nlm.nih.gov/37786644
30. Computer vision in autism spectrum disorder research: a systematic review — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC7528087/
31. Computer vision and behavioral phenotyping: an autism case study — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC10544819/
32. Using Computer Vision To Support Gut Disorder Patients — Cornell Tech, https://tech.cornell.edu/news/using-computer-vision-to-support-gut-disorder-patients/
33. "I use ChatGPT to humanize my words": Affordances and Risks of ChatGPT to Autistic Users — arXiv, https://arxiv.org/html/2601.17946v1
34. Bias-Mitigated AI as a Foundation for Resilient and Effective Health Systems — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12928680/
35. Health Equity and Ethical Considerations in Using AI in Public Health — CDC, https://www.cdc.gov/pcd/issues/2024/24_0245.htm
36. AI and Accessibility: A Discussion of Ethical Considerations — Microsoft, https://www.microsoft.com/en-us/research/wp-content/uploads/2019/08/ai4a-ethics-CACM-viewpoint-arxiv-updated.pdf
37. Bias recognition and mitigation strategies in AI healthcare applications — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC11897215/
38. A scoping review of inclusive and adaptive human-AI interaction design for neurodivergent users — ResearchGate, https://www.researchgate.net/publication/397547012
39. Privacy, ethics, transparency, and accountability in AI systems for wearable devices — PMC, https://pmc.ncbi.nlm.nih.gov/articles/PMC12209263/
40. Artificial Intelligent Implications on Health Data Privacy and Confidentiality — ResearchGate, https://www.researchgate.net/publication/387743809
41. Navigating Health Data Privacy in AI — Loeb & Loeb LLP, https://www.loeb.com/en/insights/publications/2023/10/navigating-health-data-privacy-in-ai-balancing-ethics-and-innovation
42. Continuous Wearable-Sensor Monitoring After Colorectal Surgery — MDPI, https://www.mdpi.com/2075-4418/15/17/2194
43. Cylinder acquires Dieta Health, https://cylinderhealth.com/introducing-ai-powered-stool-imaging-to-enhance-digestive-healthcare/
44. IoT for neurodivergent users: Designing inclusive smart technology — Ignitec Bristol, https://www.ignitec.com/insights/iot-for-neurodivergent-users-designing-inclusive-smart-technology/
45. Ethics of AI in Healthcare: Addressing Privacy, Bias & Trust in 2025 — Alation, https://www.alation.com/blog/ethics-of-ai-in-healthcare-privacy-bias-trust-2025/
46. Human-Centered Design to Address Biases in Artificial Intelligence — JMIR, https://www.jmir.org/2023/1/e43251/
47. Data-Driven and Participatory Approaches toward Neuro-Inclusive AI — arXiv, https://arxiv.org/abs/2507.21077
48. What Intersectional, Neurodivergent Lived Experiences Bring to Accessibility Research — arXiv, https://arxiv.org/pdf/2408.04500
49. Vaishnavi Venkata Subramanian's Speaker Profile — Sessionize, https://sessionize.com/vaishnavitv/
