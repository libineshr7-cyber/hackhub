package com.hackhub.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hackhub.entity.Event;
import com.hackhub.entity.User;
import com.hackhub.repository.EventRepository;
import com.hackhub.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Service
public class UnstopSyncService {

    private static final Logger logger = LoggerFactory.getLogger(UnstopSyncService.class);
    private static final String UNSTOP_API_URL = "https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&per_page=12";

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Run periodically every 6 hours (initialDelay = 60s after startup to keep server boot instant)
     */
    @Scheduled(initialDelay = 60000, fixedRate = 21600000)
    public void scheduledUnstopSync() {
        logger.info("🔄 Running scheduled Unstop Live Hackathons sync...");
        try {
            int syncedCount = fetchAndSyncUnstopHackathons();
            logger.info("✅ Unstop Sync completed. Total active synced hackathons: {}", syncedCount);
        } catch (Exception e) {
            logger.warn("⚠️ Unstop sync encountered an issue (non-fatal): {}", e.getMessage());
        }
    }

    public int fetchAndSyncUnstopHackathons() {
        User admin = userRepository.findByRegistrationNumber("000").orElse(null);
        if (admin == null) {
            List<User> admins = userRepository.findAll();
            if (!admins.isEmpty()) admin = admins.get(0);
        }
        if (admin == null) {
            logger.warn("No admin user found to assign synced Unstop events.");
            return 0;
        }

        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        headers.set("Accept", "application/json, text/plain, */*");
        HttpEntity<String> entity = new HttpEntity<>(headers);

        int totalSyncedCount = 0;
        int maxPages = 5; // Fetch up to 5 pages x 50 hackathons = up to 250 hackathons

        for (int page = 1; page <= maxPages; page++) {
            String pageUrl = "https://unstop.com/api/public/opportunity/search-result?opportunity=hackathons&per_page=50&page=" + page;
            try {
                ResponseEntity<String> response = restTemplate.exchange(pageUrl, HttpMethod.GET, entity, String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    JsonNode items = root.path("data").path("data");

                    if (items.isArray() && items.size() > 0) {
                        for (JsonNode item : items) {
                            try {
                                boolean synced = processUnstopItem(item, admin);
                                if (synced) totalSyncedCount++;
                            } catch (Exception itemErr) {
                                logger.debug("Could not parse single Unstop item: {}", itemErr.getMessage());
                            }
                        }
                    } else {
                        break;
                    }
                }
            } catch (Exception e) {
                logger.warn("Could not fetch Unstop hackathons page {}: {}", page, e.getMessage());
                break;
            }
        }

        return totalSyncedCount;
    }

    private boolean processUnstopItem(JsonNode item, User adminUser) {
        String title = item.path("title").asText("").trim();
        if (title.isEmpty()) return false;

        String seoUrl = item.path("seo_url").asText("").trim();
        String shortUrl = item.path("short_url").asText("").trim();
        String regLink = !seoUrl.isEmpty() ? seoUrl : (!shortUrl.isEmpty() ? shortUrl : "https://unstop.com/hackathons");
        if (!regLink.startsWith("http")) {
            regLink = "https://unstop.com/" + regLink;
        }

        // Details / Description
        String rawDetails = item.path("details").asText("");
        String cleanDesc = stripHtmlTags(rawDetails);
        if (cleanDesc.length() > 500) {
            cleanDesc = cleanDesc.substring(0, 500) + "...";
        }
        if (cleanDesc.trim().isEmpty()) {
            cleanDesc = "Live Hackathon featured on Unstop platform. Explore challenge tracks, participate with your team, and submit your project!";
        }
        cleanDesc += "\n\n🌐 (Synced Live from Unstop)";

        // Poster image
        String logoUrl = item.path("logoUrl2").asText("").trim();
        if (logoUrl.isEmpty() || !logoUrl.startsWith("http")) {
            logoUrl = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80";
        }

        // Mode (Online / Offline / Hybrid)
        String region = item.path("region").asText("online").toLowerCase();
        String mode = "HYBRID";
        if (region.contains("online")) mode = "ONLINE";
        else if (region.contains("offline")) mode = "OFFLINE";

        // Team Size
        JsonNode regnReq = item.path("regnRequirements");
        int minTeam = regnReq.path("min_team_size").asInt(1);
        int maxTeam = regnReq.path("max_team_size").asInt(4);
        if (minTeam <= 0) minTeam = 1;
        if (maxTeam < minTeam) maxTeam = Math.max(minTeam, 4);

        // Dates
        LocalDate today = LocalDate.now();
        LocalDate startDate = parseIsoDate(item.path("start_date").asText(""), today.plusDays(1));
        LocalDate endDate = parseIsoDate(item.path("end_date").asText(""), startDate.plusDays(2));
        
        String regnEndStr = regnReq.path("end_regn_dt").asText("");
        if (regnEndStr.isEmpty()) regnEndStr = item.path("end_regn_dt").asText("");
        if (regnEndStr.isEmpty()) regnEndStr = item.path("regn_end_date").asText("");
        if (regnEndStr.isEmpty()) regnEndStr = item.path("application_close_date").asText("");
        
        LocalDate deadlineDate = parseIsoDate(regnEndStr, endDate);

        // Check explicit registration status from Unstop JSON
        String regStatus = item.path("registerStatus").asText("").toLowerCase();
        String oppStatus = item.path("status").asText("").toLowerCase();
        if (regStatus.contains("closed") || regStatus.contains("expired") || oppStatus.contains("closed") || oppStatus.contains("expired") || oppStatus.contains("archived")) {
            deadlineDate = today.minusDays(1);
            endDate = today.minusDays(1);
        }

        // Venue & Org
        String orgName = item.path("organisation").path("name").asText("Unstop Partner").trim();
        String venue = orgName + " (Unstop)";

        // Skills
        StringBuilder skillsBuilder = new StringBuilder();
        JsonNode skillsArray = item.path("required_skills");
        if (skillsArray.isArray()) {
            for (JsonNode s : skillsArray) {
                String sk = s.path("skill").asText("").trim();
                if (!sk.isEmpty()) {
                    if (skillsBuilder.length() > 0) skillsBuilder.append(", ");
                    skillsBuilder.append(sk);
                }
            }
        }
        if (skillsBuilder.length() == 0) {
            skillsBuilder.append("Hackathon, Coding, Problem Solving");
        }
        skillsBuilder.append(", Unstop");

        // Check if event already exists in DB
        Optional<Event> existing = eventRepository.findByRegistrationLink(regLink);
        Event event = existing.orElse(new Event());

        event.setTitle(title);
        event.setDescription(cleanDesc);
        event.setEventType("HACKATHON");
        event.setTeamSizeMin(minTeam);
        event.setTeamSizeMax(maxTeam);
        event.setStartDate(startDate);
        event.setEndDate(endDate);
        event.setRegistrationDeadline(deadlineDate);
        event.setPosterPath(logoUrl);
        event.setRegistrationLink(regLink);
        event.setMode(mode);
        event.setVenue(venue);
        event.setSkills(skillsBuilder.toString());
        if (event.getCreatedBy() == null) {
            event.setCreatedBy(adminUser);
        }

        eventRepository.save(event);
        return true;
    }

    public int clearUnstopEvents() {
        List<Event> unstopEvents = eventRepository.findByRegistrationLinkContaining("unstop.com");
        int count = unstopEvents.size();
        if (count > 0) {
            eventRepository.deleteAll(unstopEvents);
            logger.info("🗑️ Cleared {} synced Unstop events from database.", count);
        }
        return count;
    }

    private String stripHtmlTags(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]*>", " ")
                   .replaceAll("&nbsp;", " ")
                   .replaceAll("&amp;", "&")
                   .replaceAll("&gt;", ">")
                   .replaceAll("&lt;", "<")
                   .replaceAll("\\s+", " ")
                   .trim();
    }

    private LocalDate parseIsoDate(String dateStr, LocalDate defaultDate) {
        if (dateStr == null || dateStr.trim().isEmpty()) return defaultDate;
        try {
            if (dateStr.contains("T")) {
                return ZonedDateTime.parse(dateStr).toLocalDate();
            }
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception e) {
            return defaultDate;
        }
    }
}
