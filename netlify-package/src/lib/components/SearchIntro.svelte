<script lang="ts">
  // The editorial lede that sits above the search box. Shared by the desktop
  // panel and the phone sheet so the two can't drift apart.
</script>

<div class="intro">
  <h2 class="intro-head">Iowa: How much factory farm manure is in your backyard?</h2>
  <p class="intro-body">
    The state's hog, cattle, and poultry farms produce billions of pounds of waste, polluting
    rivers and waterways across 99 counties.
  </p>
</div>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .intro-head {
    margin: 0;
    font-family: theme('fontFamily.serif');
    font-weight: 600;
    font-size: 19px;
    line-height: 1.18;
    letter-spacing: -0.015em;
    color: theme('colors.ink');
    font-variation-settings: 'opsz' 40;
    text-wrap: balance;
  }
  .intro-body {
    margin: 0;
    font-family: theme('fontFamily.sans');
    font-size: 12.5px;
    line-height: 1.5;
    color: theme('colors.ink-2');
  }

  /* The phone sheet has the full screen width to work with, so the lede can
     carry a little more weight than it does in the 340px desktop card. */
  @media (max-width: 720px), (max-height: 520px) {
    .intro-head {
      font-size: 21px;
    }
    .intro-body {
      font-size: 13.5px;
    }
  }
</style>
